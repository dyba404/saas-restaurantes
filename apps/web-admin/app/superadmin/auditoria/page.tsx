import { desc } from "drizzle-orm";
import { platformAudit } from "@rest/db";
import { getDb } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "org.suspend": "⏸ suspendió",
  "org.reactivate": "▶️ reactivó",
  "org.plan": "💳 cambió plan de",
  "user.reset_password": "🔑 reseteó password de",
  "user.remove": "🚪 quitó acceso de",
  "impersonate.start": "👤 entró como",
  "impersonate.stop": "👤 salió de impersonar a",
};

/** Bitácora de plataforma: quién hizo qué, cuándo (patrón boxyhq). */
export default async function SuperadminAuditoria() {
  await requireSuperadmin();
  const db = await getDb();
  const entries = await db
    .select()
    .from(platformAudit)
    .orderBy(desc(platformAudit.createdAt))
    .limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Auditoría de plataforma</h1>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Acción</th>
              <th className="px-3 py-2">Meta</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  {e.createdAt.toISOString().replace("T", " ").slice(0, 16)}
                </td>
                <td className="px-3 py-2">{e.actorEmail}</td>
                <td className="px-3 py-2">
                  {ACTION_LABEL[e.action] ?? e.action}{" "}
                  <span className="text-muted-foreground">{e.targetType}</span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {e.meta ? JSON.stringify(e.meta) : "—"}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>
                  Sin acciones registradas todavía
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
