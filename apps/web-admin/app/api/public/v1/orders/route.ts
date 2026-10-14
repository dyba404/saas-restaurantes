import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { authenticateApiKey } from "@/lib/public-api";
import { checkPlanLimit, createOrderForOrg } from "@/lib/orders";

/**
 * API pública v1 (F5) — para integraciones de terceros (contabilidad, delivery, BI).
 * Auth: Authorization: Bearer <api key>. RLS garantiza el alcance por tenant.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if ("error" in auth) return auth.error;
  const { org, db } = auth;

  const rows = await orgScopedOrders(db, org.id);
  return NextResponse.json({ orders: rows });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if ("error" in auth) return auth.error;
  const { org, db } = auth;

  const body = (await req.json()) as {
    channel?: string;
    items?: Array<{ name: string; quantity: number; unitPriceCents: number }>;
    totalCents?: number;
  };
  if (!body.items?.length) {
    return NextResponse.json({ error: "items es requerido" }, { status: 400 });
  }
  const limitError = await checkPlanLimit(db, org.id, org.plan);
  if (limitError) return NextResponse.json({ error: limitError }, { status: 402 });

  const created = await createOrderForOrg(db, org.id, {
    channel: body.channel && ["takeaway", "qr"].includes(body.channel) ? body.channel : "takeaway",
    items: body.items,
    totalCents: body.totalCents,
    clientUuid: crypto.randomUUID(),
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 500 });
  return NextResponse.json({ ok: true, orderNumber: created.number }, { status: 201 });
}

async function orgScopedOrders(db: import("@rest/db/local").LocalDb, orgId: string) {
  const { withTenant } = await import("@rest/db/local");
  const { orders } = await import("@rest/db");
  return withTenant(db, orgId, async (tx) =>
    tx.select().from(orders).orderBy(desc(orders.createdAt)).limit(100),
  );
}
