import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { memberships, users } from "@rest/db";
import { getDb } from "@/lib/db";
import { audit, requireSuperadmin } from "@/lib/superadmin";
import { hashSecret } from "@rest/db/local";

/** GET /api/superadmin/orgs/[id]/users — miembros del tenant. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await requireSuperadmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const db = await getDb();
  const rows = await db
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
    .where(eq(memberships.organizationId, id));
  return NextResponse.json({ users: rows });
}

/** POST /api/superadmin/orgs/[id]/users — {action:"reset-password"|"remove", userId} */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await requireSuperadmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as { action?: string; userId?: string };
  if (!body.action || !body.userId) {
    return NextResponse.json({ error: "Requiere action y userId" }, { status: 400 });
  }
  const db = await getDb();
  const [target] = await db.select().from(users).where(eq(users.id, body.userId));
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  // Regla de seguridad (lección HPC/impersonation): nadie toca a otro superadmin.
  if (target.platformRole === "superadmin") {
    return NextResponse.json({ error: "No puedes modificar a otro superadmin" }, { status: 403 });
  }

  if (body.action === "reset-password") {
    const temp = randomBytes(9).toString("base64url");
    await db
      .update(users)
      .set({ passwordHash: hashSecret(temp) })
      .where(eq(users.id, target.id));
    await audit(admin.email, "user.reset_password", "user", target.id, { email: target.email });
    // La temporal se devuelve UNA vez y no se vuelve a mostrar.
    return NextResponse.json({ ok: true, tempPassword: temp });
  }

  if (body.action === "remove") {
    await db
      .delete(memberships)
      .where(and(eq(memberships.organizationId, id), eq(memberships.userId, target.id)));
    await audit(admin.email, "user.remove", "user", target.id, {
      email: target.email,
      orgId: id,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action inválida" }, { status: 400 });
}
