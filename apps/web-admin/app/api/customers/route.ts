import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { customers } from "@rest/db";
import { withTenant } from "@rest/db/local";
import { withOrgApi, preflight } from "@/lib/api";

/** GET /api/customers — CRM del restaurante (los datos son suyos, promesa anti-lock-in). */
export const GET = withOrgApi(async ({ org, db }) => {
  const data = await withTenant(db, org.id, async (tx) => {
    return tx
      .select()
      .from(customers)
      .orderBy(desc(customers.loyaltyPoints))
      .limit(200);
  });

  return NextResponse.json({
    customers: data.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      loyaltyPoints: c.loyaltyPoints,
      lastVisitAt: c.lastVisitAt ? new Date(c.lastVisitAt).toISOString() : null,
    })),
  });
});

/** POST /api/customers — alta manual desde el CRM. Dedupe por teléfono. */
export const POST = withOrgApi(async ({ org, db, req }) => {
  const body = (await req.json()) as { name?: string; phone?: string };
  const name = body.name?.trim() ?? "";
  const phone = body.phone?.trim() ?? "";
  if (name.length < 2 || phone.length < 6) {
    return NextResponse.json({ error: "Nombre y teléfono válidos son requeridos" }, { status: 400 });
  }

  const result = await withTenant(db, org.id, async (tx) => {
    const [existing] = await tx.select().from(customers).where(eq(customers.phone, phone));
    if (existing) return { duplicate: true as const };
    const [row] = await tx
      .insert(customers)
      .values({ organizationId: org.id, name, phone, loyaltyPoints: 0 })
      .returning({ id: customers.id, name: customers.name, phone: customers.phone });
    return { customer: row };
  });

  if ("duplicate" in result) {
    return NextResponse.json(
      { error: "Ya existe un cliente con ese teléfono" },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, customer: result.customer });
});

export const OPTIONS = preflight;
