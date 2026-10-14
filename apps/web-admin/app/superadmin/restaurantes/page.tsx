import Link from "next/link";
import { desc, eq, gte, sql } from "drizzle-orm";
import { memberships, organizations, orders, users } from "@rest/db";
import { getDb } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { TenantActions } from "../components";

export const dynamic = "force-dynamic";

/** Lista completa de tenants con uso del mes, plan y estado. */
export default async function SuperadminRestaurantes() {
  await requireSuperadmin();
  const db = await getDb();

  const orgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
  const usage = await db
    .select({ orgId: orders.organizationId, count: sql<number>`count(*)::int` })
    .from(orders)
    .where(gte(orders.createdAt, sql`date_trunc('month', now())`))
    .groupBy(orders.organizationId);
  const usageByOrg = new Map(usage.map((u) => [u.orgId, Number(u.count)]));
  const owners = await db
    .select({ orgId: memberships.organizationId, email: users.email })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.role, "owner"));
  const ownerByOrg = new Map(owners.map((o) => [o.orgId, o.email]));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Restaurantes (tenants)</h1>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Restaurante</th>
              <th className="px-3 py-2">Dueño</th>
              <th className="px-3 py-2">Alta</th>
              <th className="px-3 py-2 text-right">Órdenes/mes</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <Link
                    href={`/superadmin/restaurantes/${org.slug}`}
                    className="font-semibold hover:underline"
                  >
                    {org.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{org.slug}</span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{ownerByOrg.get(org.id) ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {org.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums">
                  {usageByOrg.get(org.id) ?? 0}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    / {org.plan === "free" ? "100" : org.plan === "pro" ? "5.000" : "50.000"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-xs font-medium " +
                      (org.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400")
                    }
                  >
                    {org.status === "active" ? "activo" : "suspendido"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end">
                    <TenantActions
                      org={{
                        id: org.id,
                        name: org.name,
                        slug: org.slug,
                        plan: org.plan,
                        status: org.status,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                  Sin restaurantes aún — regístrate en /signup (con tu SUPERADMIN_EMAIL
                  naces como superadmin)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
