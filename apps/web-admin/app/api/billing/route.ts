import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { organizations } from "@rest/db";
import { getOrgBySlug, getUsage, PLANS, type PlanId } from "@/lib/orders";
import { getDb } from "@/lib/db";

/** GET /api/billing — plan actual, uso del mes y catálogo de planes. */
export async function GET(req: NextRequest) {
  const slug = req.headers.get("x-org-slug");
  if (!slug) return NextResponse.json({ error: "Falta X-Org-Slug" }, { status: 400 });
  const db = await getDb();
  const org = await getOrgBySlug(db, slug);
  if (!org) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });

  const usage = await getUsage(db, org.id, org.plan);
  return NextResponse.json({
    plan: usage.plan,
    priceCents: usage.priceCents,
    ordersThisMonth: usage.ordersThisMonth,
    monthlyOrders: usage.monthlyOrders,
    maxLocations: usage.maxLocations,
    plans: Object.entries(PLANS).map(([id, p]) => ({ id, ...p })),
  });
}

/**
 * POST /api/billing {plan} — cambio de plan.
 * Producción: crea la suscripción en Stripe/MercadoPago y el webhook confirma.
 * Demo (sin credenciales): aplica el plan directamente y lo marca sandbox.
 */
export async function POST(req: NextRequest) {
  const { plan, orgSlug } = (await req.json()) as { plan?: PlanId; orgSlug?: string };
  const slug = orgSlug ?? req.headers.get("x-org-slug");
  if (!slug || !plan || !(plan in PLANS)) {
    return NextResponse.json({ error: "Requiere plan válido (free|pro|multi) y orgSlug" }, { status: 400 });
  }
  const db = await getDb();
  const org = await getOrgBySlug(db, slug);
  if (!org) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });

  await db.update(organizations).set({ plan }).where(eq(organizations.id, org.id));
  return NextResponse.json({
    ok: true,
    plan,
    priceCents: PLANS[plan].priceCents,
    sandbox: true,
    note: "Producción: checkout Stripe/MercadoPago + webhook de confirmación. Demo: aplicado directo.",
  });
}
