import { NextResponse } from "next/server";
import { asc, eq, inArray } from "drizzle-orm";
import { diningTables, orderItems, orders } from "@rest/db";
import { withTenant } from "@rest/db/local";
import { withOrgApi, preflight } from "@/lib/api";

const channelLabels: Record<string, string> = {
  pos: "POS",
  qr: "Menú QR",
  whatsapp: "WhatsApp",
  takeaway: "Para llevar",
  rappi: "Rappi",
  glovo: "Glovo",
  pedidosya: "PedidosYa",
  ubereats: "Uber Eats",
};

/**
 * GET /api/orders?active=1 — cola viva para el KDS y las órdenes abiertas del POS.
 * RLS (app.tenant_id) filtra por organización; el cliente no ve nada ajeno.
 */
export const GET = withOrgApi(async ({ org, db, req }) => {
  const activeOnly = req.nextUrl.searchParams.get("active") === "1";

  const data = await withTenant(db, org.id, async (tx) => {
    const rows = await tx
      .select({ order: orders, tableName: diningTables.name })
      .from(orders)
      .leftJoin(diningTables, eq(orders.tableId, diningTables.id))
      .where(
        activeOnly
          ? inArray(orders.status, ["sent", "preparing", "ready"])
          : inArray(orders.status, ["sent", "preparing", "ready", "paid"]),
      )
      .orderBy(asc(orders.createdAt))
      .limit(100);

    if (rows.length === 0) return [];

    const items = await tx
      .select()
      .from(orderItems)
      .where(
        inArray(
          orderItems.orderId,
          rows.map((r) => r.order.id),
        ),
      );

    const modifiersOf = (mods: unknown): string[] =>
      Array.isArray(mods) ? (mods as Array<{ name: string }>).map((m) => m.name) : [];

    return rows.map(({ order, tableName }) => ({
      number: order.number,
      channel: order.channel,
      channelLabel: channelLabels[order.channel] ?? order.channel,
      status: order.status,
      target: tableName ?? channelLabels[order.channel] ?? order.channel,
      staffName: null,
      elapsedMinutes: Math.max(
        0,
        Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60_000),
      ),
      createdAt: order.createdAt,
      items: items
        .filter((i) => i.orderId === order.id)
        .map((i) => ({
          name: i.name,
          quantity: i.quantity,
          notes: i.notes ?? undefined,
          modifiers: modifiersOf(i.modifiersJson),
          // Precio unitario real: el ticket debe mostrar precios exactos.
          unitPriceCents: i.unitPriceCents,
        })),
      totalCents: order.totalCents,
    }));
  });

  return NextResponse.json({ orders: data });
});

export const OPTIONS = preflight;
