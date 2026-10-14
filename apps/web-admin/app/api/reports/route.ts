import { NextResponse } from "next/server";
import { and, eq, gte, sql, type SQL } from "drizzle-orm";
import { orderItems, orders, payments, reservations } from "@rest/db";
import { withTenant } from "@rest/db/local";
import { withOrgApi, preflight } from "@/lib/api";

/**
 * GET /api/reports?range=hoy|7d|30d — reporte de ventas REAL por rango:
 * serie temporal (por hora si es hoy, por día si es mayor), mezcla por canal,
 * métodos de pago, top productos y reservas del periodo. Cero mocks.
 */
const RANGES: Record<string, { desde: SQL; label: string; hourly: boolean }> = {
  hoy: { desde: sql`date_trunc('day', now())`, label: "Hoy", hourly: true },
  "7d": { desde: sql`now() - interval '7 days'`, label: "Últimos 7 días", hourly: false },
  "30d": { desde: sql`now() - interval '30 days'`, label: "Últimos 30 días", hourly: false },
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  mercadopago: "MercadoPago",
  stripe: "Stripe",
  mixed: "Mixto",
  payment_link: "Link de pago",
};

const CHANNEL_LABEL: Record<string, string> = {
  pos: "POS",
  qr: "Carta QR",
  whatsapp: "WhatsApp",
  takeaway: "Para llevar",
  rappi: "Rappi",
  glovo: "Glovo",
  pedidosya: "PedidosYa",
  ubereats: "Uber Eats",
};

export const GET = withOrgApi(async ({ org, db, req }) => {
  const rangeKey = req.nextUrl.searchParams.get("range") ?? "7d";
  const range = RANGES[rangeKey] ?? RANGES["7d"]!;

  return withTenant(db, org.id, async (tx) => {
    const desde = range.desde;

    // Totales del periodo (dinero cobrado)
    const [tot] = await tx
      .select({
        ventas: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
        propinas: sql<number>`coalesce(sum(${payments.tipCents}), 0)::int`,
        tickets: sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(gte(payments.createdAt, desde));

    // Serie temporal COMPLETA del rango: los días/horas sin ventas van en 0 —
    // si solo se incluiran los días con datos, el gráfico dibujaría una sola
    // barra gigante que ocupa todo el ancho.
    const serieRows = range.hourly
      ? await tx
          .select({
            punto: sql<number>`extract(hour from ${payments.createdAt})::int`,
            cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
          })
          .from(payments)
          .where(gte(payments.createdAt, desde))
          .groupBy(sql`1`)
          .orderBy(sql`1`)
      : await tx
          .select({
            punto: sql<string>`to_char(date_trunc('day', ${payments.createdAt}), 'DD/MM')`,
            cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
          })
          .from(payments)
          .where(gte(payments.createdAt, desde))
          .groupBy(sql`1`)
          .orderBy(sql`min(${payments.createdAt})`);

    const reales = new Map<string, number>(
      serieRows.map((r) => [String(r.punto), Number(r.cents)]),
    );

    const series: Array<{ label: string; cents: number }> = [];
    if (range.hourly) {
      for (let h = 0; h < 24; h++) {
        series.push({ label: `${h}h`, cents: reales.get(String(h)) ?? 0 });
      }
    } else {
      const dias = rangeKey === "30d" ? 30 : 7;
      for (let i = dias - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
        series.push({ label, cents: reales.get(label) ?? 0 });
      }
    }

    // Por canal (dinero cobrado)
    const canalRows = await tx
      .select({
        channel: orders.channel,
        cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(gte(payments.createdAt, desde))
      .groupBy(orders.channel);

    const totalVentas = canalRows.reduce((s, c) => s + Number(c.cents), 0);
    const byChannel = canalRows
      .map((c) => ({
        name: CHANNEL_LABEL[c.channel] ?? c.channel,
        cents: Number(c.cents),
        pct: totalVentas > 0 ? Math.round((Number(c.cents) / totalVentas) * 100) : 0,
      }))
      .sort((a, b) => b.cents - a.cents);

    // Por método de pago (sustituye "por empleado": las órdenes aún no
    // registran el mesero que las atendió)
    const metodoRows = await tx
      .select({
        method: payments.method,
        cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
        tickets: sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(gte(payments.createdAt, desde))
      .groupBy(payments.method)
      .orderBy(sql`2 desc`);

    const byEmployee = metodoRows.map((m) => ({
      name: METHOD_LABEL[m.method] ?? m.method,
      salesCents: Number(m.cents),
      tickets: Number(m.tickets),
    }));

    // Top productos del periodo (órdenes cobradas)
    const topRows = await tx
      .select({
        name: orderItems.name,
        count: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
        revenue: sql<number>`coalesce(sum(${orderItems.totalCents}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(gte(orders.createdAt, desde), eq(orders.status, "paid")))
      .groupBy(orderItems.name)
      .orderBy(sql`3 desc`)
      .limit(5);

    // Reservas del periodo (por fecha de la reserva; los estados son del enum)
    const resRows = await tx
      .select({ status: reservations.status, n: sql<number>`count(*)::int` })
      .from(reservations)
      .where(gte(reservations.startsAt, desde))
      .groupBy(reservations.status);
    const byStatus = Object.fromEntries(resRows.map((r) => [r.status, Number(r.n)]));
    const booked = resRows.reduce(
      (s, r) => s + (r.status === "cancelled" ? 0 : Number(r.n)),
      0,
    );

    const tickets = tot?.tickets ?? 0;
    const ventas = tot?.ventas ?? 0;

    return NextResponse.json({
      label: range.label,
      seriesLabel: range.hourly ? "Ventas por hora (hoy)" : `Ventas por día · ${range.label}`,
      salesCents: ventas,
      tickets,
      avgTicketCents: tickets > 0 ? Math.round(ventas / tickets) : 0,
      propinasCents: tot?.propinas ?? 0,
      series,
      byChannel,
      byEmployee,
      topProducts: topRows.map((t) => ({
        name: t.name,
        count: Number(t.count),
        revenueCents: Number(t.revenue),
      })),
      reservations: {
        booked,
        seated: byStatus["seated"] ?? 0,
        noShows: byStatus["no_show"] ?? 0,
      },
    });
  });
});

export const OPTIONS = preflight;
