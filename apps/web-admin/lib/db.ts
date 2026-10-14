import { createDb } from "@rest/db";
import type { LocalDb } from "@rest/db/local";

/**
 * Fábrica de la conexión a la DB.
 *
 * - DATABASE_URL definido (deploy/Docker/Neon): Postgres REAL vía postgres-js.
 *   El cliente es un SINGLETON: crear un pool por request agotaría las
 *   conexiones de Postgres ("too many clients already", error 53300 visto en
 *   producción). postgres-js reusa su pool interno entre requests.
 * - Sin DATABASE_URL (dev): Postgres embebido (pglite) con seed demo automático.
 *
 * El tipo LocalDb describe el contrato (drizzle + schema) compartido por ambos
 * drivers; el cast es seguro porque solo difiere el driver de conexión.
 */
let cachedDb: LocalDb | null = null;

export async function getDb(): Promise<LocalDb> {
  const url = process.env.DATABASE_URL;
  if (url) {
    if (!cachedDb) {
      cachedDb = createDb(url) as unknown as LocalDb;
    }
    return cachedDb;
  }
  const { getLocalDb } = await import("@rest/db/local");
  return getLocalDb();
}

export type { LocalDb };
