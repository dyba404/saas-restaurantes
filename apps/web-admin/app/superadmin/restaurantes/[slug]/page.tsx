import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { memberships, organizations, users } from "@rest/db";
import { getDb } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { TenantActions, TenantDevices, UserActions } from "../../components";

export const dynamic = "force-dynamic";

/** Detalle de un tenant: datos + gestión de usuarios (reset/acceso/impersonar). */
export default async function SuperadminTenant({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireSuperadmin();
  const { slug } = await params;
  const db = await getDb();

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
  if (!org) notFound();

  const miembros = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      role: memberships.role,
      platformRole: users.platformRole,
      createdAt: users.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organizationId, org.id));

  return (
    <div className="space-y-6">
      <Link href="/superadmin/restaurantes" className="text-sm text-muted-foreground hover:underline">
        ← Restaurantes
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h1 className="text-lg font-bold">{org.name}</h1>
          <p className="text-sm text-muted-foreground">
            slug: <code className="text-foreground/80">{org.slug}</code> · plan {org.plan} · alta{" "}
            {org.createdAt.toISOString().slice(0, 10)}
          </p>
        </div>
        <TenantActions
          org={{ id: org.id, name: org.name, slug: org.slug, plan: org.plan, status: org.status }}
        />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground/80">Usuarios con acceso</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Solo cuentas con login (dueño y gerentes que administran el panel). Los empleados de piso
          (meseros, cocina, caja) <strong>no crean cuenta</strong>: entran a la tablet del POS con un PIN y se
          gestionan en el módulo «Staff» del propio restaurante.
        </p>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Rol</th>
                <th className="px-3 py-2">Alta</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {miembros.map((u) => (
                <tr key={u.userId} className="border-t border-border">
                  <td className="px-3 py-2">
                    {u.name}
                    <span className="block text-xs text-muted-foreground">{u.email}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {u.role}
                    {u.platformRole === "superadmin" && (
                      <span className="ml-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                        superadmin
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {u.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <UserActions orgId={org.id} user={u} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <TenantDevices orgId={org.id} />
    </div>
  );
}
