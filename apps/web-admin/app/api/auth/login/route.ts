import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { memberships, organizations, users } from "@rest/db";
import { asRuntime, verifySecret } from "@rest/db/local";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
  }

  const db = await getDb();
  const normalizedEmail = email.toLowerCase().trim();

  // Login: users no lleva RLS (se busca por email antes de conocer el tenant).
  // memberships SÍ lleva RLS (política app.user_id) → se setea el GUC en cuanto
  // se identifica al usuario, y la pertenencia a organizaciones queda filtrada.
  const result = await asRuntime(db, async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.email, normalizedEmail));
    if (!user?.passwordHash || !verifySecret(password, user.passwordHash)) return null;

    await tx.execute(sql`SELECT set_config('app.user_id', ${user.id}, true)`);
    const orgs = await tx
      .select({ org: organizations, role: memberships.role })
      .from(memberships)
      .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
      .where(eq(memberships.userId, user.id));
    // Sin organizaciones solo pueden entrar superadmins (dueños de plataforma):
    // un usuario normal sin tenant no tiene nada que ver en el panel.
    if (orgs.length === 0 && user.platformRole !== "superadmin") return null;
    return { user, firstOrg: orgs[0] ?? null };
  });

  if (!result) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    user: { name: result.user.name, email: result.user.email },
    organization: result.firstOrg
      ? { name: result.firstOrg.org.name, slug: result.firstOrg.org.slug }
      : null,
  });
  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken({ uid: result.user.id, email: result.user.email, name: result.user.name }),
    sessionCookieOptions,
  );
  return response;
}
