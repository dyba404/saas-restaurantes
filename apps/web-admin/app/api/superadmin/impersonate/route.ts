import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { users } from "@rest/db";
import { getDb } from "@/lib/db";
import { audit, requireSuperadmin } from "@/lib/superadmin";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/auth";

/**
 * POST /api/superadmin/impersonate {userId} — "Entrar como": crea una sesión
 * del usuario objetivo con actor claim (act.email = superadmin). Auditada.
 * Regla de seguridad: nunca sobre otro superadmin.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const admin = await requireSuperadmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = (await req.json()) as { userId?: string };
  if (!body.userId) return NextResponse.json({ error: "Requiere userId" }, { status: 400 });

  const db = await getDb();
  const [target] = await db.select().from(users).where(eq(users.id, body.userId));
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (target.platformRole === "superadmin") {
    return NextResponse.json({ error: "No puedes impersonar a otro superadmin" }, { status: 403 });
  }

  await audit(admin.email, "impersonate.start", "user", target.id, { email: target.email });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken({
      uid: target.id,
      email: target.email,
      name: target.name,
      act: { email: admin.email },
    }),
    sessionCookieOptions,
  );
  return response;
}
