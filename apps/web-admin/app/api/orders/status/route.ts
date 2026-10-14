import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { orders } from "@rest/db";
import { withTenant } from "@rest/db/local";
import { withOrgApi, preflight } from "@/lib/api";
import { publishOrdersChanged } from "@/lib/realtime-bus";

/** POST /api/orders/status {number, status} — avance del KDS (offline-tolerante). */
export const POST = withOrgApi(async ({ org, db, req }) => {
  const { number, status } = (await req.json()) as {
    number?: number;
    status?: "preparing" | "ready" | "served";
  };
  if (!number || !status || !["preparing", "ready", "served"].includes(status)) {
    return NextResponse.json(
      { error: "Requiere number y status (preparing|ready|served)" },
      { status: 400 },
    );
  }

  const updated = await withTenant(db, org.id, async (tx) => {
    const rows = await tx
      .update(orders)
      .set({ status })
      .where(eq(orders.number, number))
      .returning({ id: orders.id });
    return rows.length;
  });

  if (updated === 0) {
    return NextResponse.json({ error: `Orden #${number} no encontrada` }, { status: 404 });
  }
  publishOrdersChanged(org.id);
  return NextResponse.json({ ok: true, number, status });
});

export const OPTIONS = preflight;
