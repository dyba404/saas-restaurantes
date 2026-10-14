import { gte, sql } from "drizzle-orm";
import { organizations, orders } from "@rest/db";
import { getDb } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";

export const dynamic = "force-dynamic";

/** Resumen de plataforma: North Star (órdenes/semana) + estado de tenants. */
export default async function SuperadminResumen() {
  await requireSuperadmin(); // el layout ya guarda; doble check barato
  const db = await getDb();

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(organizations);
  const [{ activos }] = await db
    .select({ activos: sql<number>`count(*)::int` })
    .from(organizations)
    .where(sql`${organizations.status} = 'active'`);
  const [{ semana }] = await db
    .select({ semana: sql<number>`count(*)::int` })
    .from(orders)
    .where(gte(orders.createdAt, sql`now() - interval '7 days'`));
  const [{ mes }] = await db
    .select({ mes: sql<number>`count(*)::int` })
    .from(orders)
    .where(gte(orders.createdAt, sql`date_trunc('month', now())`));

  const top = await db
    .select({
      name: organizations.name,
      slug: organizations.slug,
      plan: organizations.plan,
      ordenes: sql<number>`count(${orders.id})::int`,
    })
    .from(organizations)
    .leftJoin(orders, gte(orders.createdAt, sql`now() - interval '30 days'`))
    .groupBy(organizations.id, organizations.name, organizations.slug, organizations.plan)
    .orderBy(sql`count(${orders.id}) desc`)
    .limit(5);

  const cards = [
    { label: "Restaurantes", value: total, hint: `${total - activos} suspendidos` },
    { label: "Órdenes · 7 días", value: semana, hint: "North Star del roadmap" },
    { label: "Órdenes · mes", value: mes, hint: "base de facturación" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{c.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground/80">
          Top restaurantes · últimos 30 días
        </h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Restaurante</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2 text-right">Órdenes</th>
              </tr>
            </thead>
            <tbody>
              {top.map((r) => (
                <tr key={r.slug} className="border-t border-border">
                  <td className="px-3 py-2">
                    {r.name} <span className="text-muted-foreground">· {r.slug}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.plan}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{r.ordenes}</td>
                </tr>
              ))}
              {top.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-muted-foreground" colSpan={3}>
                    Aún no hay restaurantes registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
