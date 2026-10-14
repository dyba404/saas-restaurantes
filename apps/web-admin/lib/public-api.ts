import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { apiKeys, organizations } from "@rest/db";
import { verifySecret } from "@rest/db/local";
import { getDb, type LocalDb } from "@/lib/db";
import type { Organization } from "@rest/db";

/**
 * Autenticación de la API pública (F5): Authorization: Bearer rk_live_xxx.yyy
 * — prefijo busca la llave, scrypt verifica el secreto, RLS filtra los datos.
 */
export async function authenticateApiKey(
  req: NextRequest,
): Promise<{ org: Organization; db: LocalDb } | { error: NextResponse }> {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !token.includes(".")) {
    return { error: NextResponse.json({ error: "Falta Authorization: Bearer <api key>" }, { status: 401 }) };
  }
  const [prefix, secret] = token.split(".");
  const db = await getDb();
  const rows = await asRuntimeSafe(db, prefix);
  const key = rows[0];
  if (!key || key.revokedAt || !verifySecret(secret, key.keyHash)) {
    return { error: NextResponse.json({ error: "API key inválida o revocada" }, { status: 401 }) };
  }
  const [org] = await db.select().from(organizations).where(eq(organizations.id, key.organizationId));
  if (!org) return { error: NextResponse.json({ error: "Organización no encontrada" }, { status: 404 }) };
  return { org, db };
}

async function asRuntimeSafe(db: LocalDb, prefix: string) {
  const { asRuntime } = await import("@rest/db/local");
  return asRuntime(db, async (tx) =>
    tx.select().from(apiKeys).where(and(eq(apiKeys.prefix, prefix), isNull(apiKeys.revokedAt))),
  );
}
