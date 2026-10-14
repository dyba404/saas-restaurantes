import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";

/**
 * Fábrica del cliente DB. Neon (o cualquier Postgres) vía DATABASE_URL.
 * La sesión multi-tenant se activa por transacción:
 *   await db.transaction(async (tx) => { ... })
 * con `set local app.tenant_id = '<uuid>'` antes de cada query de dominio.
 */
export function createDb(url: string) {
  const client = postgres(url, { prepare: false });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

/** Tenant activo de la request (middleware/route handler lo extrae del auth). */
export const TENANT_GUC = "app.tenant_id";
