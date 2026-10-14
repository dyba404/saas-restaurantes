import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { apiKeys } from "@rest/db";
import { asRuntime, hashSecret } from "@rest/db/local";
import { getOrgBySlug } from "@/lib/orders";
import { getDb } from "@/lib/db";

function newKey() {
  const prefix = `rk_live_${crypto.randomUUID().slice(0, 8)}`;
  const secret = crypto.randomUUID().replace(/-/g, "");
  return { full: `${prefix}.${secret}`, prefix, secret };
}

/** GET /api/keys?orgSlug= — llaves activas (el secreto nunca se vuelve a mostrar). */
export async function GET(req: NextRequest) {
  const slug = req.headers.get("x-org-slug") ?? req.nextUrl.searchParams.get("orgSlug");
  if (!slug) return NextResponse.json({ error: "Falta orgSlug" }, { status: 400 });
  const db = await getDb();
  const org = await getOrgBySlug(db, slug);
  if (!org) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
  const rows = await asRuntime(db, async (tx) =>
    tx
      .select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, createdAt: apiKeys.createdAt })
      .from(apiKeys)
      .where(and(eq(apiKeys.organizationId, org.id), isNull(apiKeys.revokedAt)))
      .orderBy(desc(apiKeys.createdAt)),
  );
  return NextResponse.json({ keys: rows });
}

/** POST /api/keys {name, orgSlug} — crea la llave; el secreto se muestra UNA vez. */
export async function POST(req: NextRequest) {
  const { name, orgSlug } = (await req.json()) as { name?: string; orgSlug?: string };
  if (!name || !orgSlug) return NextResponse.json({ error: "Requiere name y orgSlug" }, { status: 400 });
  const db = await getDb();
  const org = await getOrgBySlug(db, orgSlug);
  if (!org) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });

  const { full, prefix, secret } = newKey();
  await asRuntime(db, async (tx) => {
    await tx.insert(apiKeys).values({ organizationId: org.id, name, prefix, keyHash: hashSecret(secret) });
  });
  return NextResponse.json({ ok: true, key: full, note: "Guarda este secreto ahora: no volverá a mostrarse." }, { status: 201 });
}

/** DELETE /api/keys?id=&orgSlug= — revoca la llave. */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const slug = req.headers.get("x-org-slug") ?? req.nextUrl.searchParams.get("orgSlug");
  if (!id || !slug) return NextResponse.json({ error: "Requiere id y orgSlug" }, { status: 400 });
  const db = await getDb();
  const org = await getOrgBySlug(db, slug);
  if (!org) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
  await asRuntime(db, async (tx) => {
    await tx
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, org.id)));
  });
  return NextResponse.json({ ok: true });
}
