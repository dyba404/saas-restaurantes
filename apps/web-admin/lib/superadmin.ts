import { eq } from "drizzle-orm";
import { platformAudit, users } from "@rest/db";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * Guard del panel de plataforma: sesión válida + rol superadmin en DB (lookup
 * fresco, nunca confiando en el token: revocar el rol corta el acceso al instante).
 * Todas las rutas /api/superadmin/** y páginas /superadmin/** pasan por aquí.
 */
export async function requireSuperadmin(): Promise<{ uid: string; email: string } | null> {
  const session = await getSession();
  if (!session) return null;
  const db = await getDb();
  const [user] = await db
    .select({ role: users.platformRole, email: users.email })
    .from(users)
    .where(eq(users.id, session.uid));
  if (!user || user.role !== "superadmin") return null;
  return { uid: session.uid, email: user.email };
}

/** Rol de plataforma del usuario (lookup fresco). "superadmin" | null. */
export async function getPlatformRole(uid: string): Promise<string | null> {
  const db = await getDb();
  const [user] = await db
    .select({ role: users.platformRole })
    .from(users)
    .where(eq(users.id, uid));
  return user?.role ?? null;
}

/** Cada acción de plataforma deja rastro (patrón boxyhq): actor+acción+objetivo+meta. */
export async function audit(
  actorEmail: string,
  action: string,
  targetType: "organization" | "user",
  targetId?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  await db.insert(platformAudit).values({
    actorEmail,
    action,
    targetType,
    targetId: targetId ?? null,
    meta: meta ?? null,
  });
}
