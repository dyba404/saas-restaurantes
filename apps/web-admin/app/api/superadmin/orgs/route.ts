import { NextResponse } from "next/server";
import { desc, eq, gte, sql } from "drizzle-orm";
import { memberships, organizations, orders, users } from "@rest/db";
import { getDb } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";

/** GET /api/superadmin/orgs — lista de tenants con uso real del mes y dueño. */
export async function GET(): Promise<NextResponse> {
  const admin = await requireSuperadmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const db = await getDb();
  const orgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt));

  const usage = await db
    .select({ orgId: orders.organizationId, count: sql<number>`count(*)::int` })
    .from(orders)
    .where(gte(orders.createdAt, sql`date_trunc('month', now())`))
    .groupBy(orders.organizationId);
  const usageByOrg = new Map(usage.map((u) => [u.orgId, Number(u.count)]));

  const owners = await db
    .select({ orgId: memberships.organizationId, email: users.email, name: users.name })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.role, "owner"));
  const ownerByOrg = new Map(owners.map((o) => [o.orgId, o]));

  return NextResponse.json({
    orgs: orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      status: org.status,
      currency: org.currency,
      createdAt: org.createdAt,
      ordersThisMonth: usageByOrg.get(org.id) ?? 0,
      ownerEmail: ownerByOrg.get(org.id)?.email ?? null,
    })),
  });
}
