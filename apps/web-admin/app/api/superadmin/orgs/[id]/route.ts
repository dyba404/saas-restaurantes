import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { organizations } from "@rest/db";
import { getDb } from "@/lib/db";
import { audit, requireSuperadmin } from "@/lib/superadmin";

const PLANS = new Set(["free", "pro", "multi"]);
const STATUSES = new Set(["active", "suspended"]);

/** PATCH /api/superadmin/orgs/[id] — {status} o {plan}. Audita siempre. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await requireSuperadmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as { status?: string; plan?: string };
  const db = await getDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!org) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });

  if (body.status != null) {
    if (!STATUSES.has(body.status)) {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }
    await db.update(organizations).set({ status: body.status }).where(eq(organizations.id, id));
    await audit(
      admin.email,
      body.status === "suspended" ? "org.suspend" : "org.reactivate",
      "organization",
      id,
      { name: org.name, slug: org.slug },
    );
  }

  if (body.plan != null) {
    if (!PLANS.has(body.plan)) {
      return NextResponse.json({ error: "plan inválido" }, { status: 400 });
    }
    await db.update(organizations).set({ plan: body.plan }).where(eq(organizations.id, id));
    await audit(admin.email, "org.plan", "organization", id, {
      name: org.name,
      slug: org.slug,
      from: org.plan,
      to: body.plan,
    });
  }

  return NextResponse.json({ ok: true });
}
