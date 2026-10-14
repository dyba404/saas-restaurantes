import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { users } from "@rest/db";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/superadmin";
import { SESSION_COOKIE, createSessionToken, getSession, sessionCookieOptions } from "@/lib/auth";

/**
 * POST /api/superadmin/stop-impersonate — restaura la sesión del superadmin.
 *
 * NO pasa por requireSuperadmin: la sesión que llama es la impersonada (uid =
 * usuario objetivo) y por definición ya no es superadmin. La autoridad viene
 * del actor claim firmado (act.email) de la propia cookie: se verifica que el
 * actor siga siendo superadmin y se re-emite su sesión limpia.
 */
export async function POST(): Promise<NextResponse> {
  const session = await getSession();
  if (!session?.act) {
    return NextResponse.json({ error: "No hay impersonación activa" }, { status: 400 });
  }

  const db = await getDb();
  const [actor] = await db.select().from(users).where(eq(users.email, session.act.email));
  if (!actor || actor.platformRole !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await audit(actor.email, "impersonate.stop", "user", session.uid, {
    email: session.email,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken({ uid: actor.id, email: actor.email, name: actor.name }),
    sessionCookieOptions,
  );
  return response;
}
