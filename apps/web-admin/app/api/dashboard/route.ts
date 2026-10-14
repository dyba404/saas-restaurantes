import { NextResponse } from "next/server";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { ingredients, locations, orderItems, orders, payments, products } from "@rest/db";
import { withOrgApi, preflight } from "@/lib/api";
import { withTenant } from "@rest/db/local";

/**
 * GET /api/dashboard — métricas REALES del día para el Resumen del panel:
 * dinero cobrado (payments), tickets, ticket medio, propinas, ventas por hora,
 * top productos, mezcla por canal y alertas operativas. Nada de mocks.
 */
export const GET = withOrgApi(async ({ org, db }) => {
  return withTenant(db, org.id, async (tx) => {
    const today = sql`date_trunc('day', now())`;

    const [pay] = await tx
      .select({
        ventas: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
        propinas: sql<number>`coalesce(sum(${payments.tipCents}), 0)::int`,
        tickets: sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(gte(payments.createdAt, today));

    const porHora = await tx
      .select({
        hora: sql<number>`extract(hour from ${payments.createdAt})::int`,
        ventas: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
      })
      .from(payments)
      .where(gte(payments.createdAt, today))
      .groupBy(sql`1`);

    const top = await tx
      .select({
        name: orderItems.name,
        uds: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
        ventas: sql<number>`coalesce(sum(${orderItems.totalCents}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(gte(orders.createdAt, today), eq(orders.status, "paid")))
      .groupBy(orderItems.name)
      .orderBy(sql`2 desc`)
      .limit(5);

    const porCanal = await tx
      .select({
        channel: orders.channel,
        ventas: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(gte(payments.createdAt, today))
      .groupBy(orders.channel);

    const [agotados] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(products)
      .where(and(eq(products.available, false), eq(products.active, true)));
    const [bajoStock] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(ingredients)
      .where(sql`${ingredients.stockQty} < ${ingredients.minQty}`);
    const [esperando] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          inArray(orders.status, ["sent", "preparing"]),
          sql`${orders.createdAt} < now() - interval '10 minutes'`,
        ),
      );

    const [location] = await tx
      .select({ name: locations.name })
      .from(locations)
      .where(eq(locations.organizationId, org.id))
      .limit(1);

    return NextResponse.json({
      date: new Date().toISOString(),
      location: location?.name ?? "Principal",
      ventasCents: pay?.ventas ?? 0,
      propinasCents: pay?.propinas ?? 0,
      tickets: pay?.tickets ?? 0,
      ticketMedioCents: pay && pay.tickets > 0 ? Math.round(pay.ventas / pay.tickets) : 0,
      porHora,
      top,
      porCanal,
      alertas: {
        agotados: agotados?.n ?? 0,
        bajoStock: bajoStock?.n ?? 0,
        esperando: esperando?.n ?? 0,
      },
    });
  });
});

export const OPTIONS = preflight;

