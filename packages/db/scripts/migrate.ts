/**
 * Migrador para Postgres REAL (deploy). Compilado a .mjs con esbuild en el
 * Dockerfile y corrido como servicio one-shot antes de las apps.
 *
 * - Aplica las migraciones generadas (drizzle/*.sql) con su propia tabla
 *   rest_migrations: idempotente (re-ejecutar no re-aplica nada).
 * - Orden: schema primero, RLS SIEMPRE al final (crea policies sobre tablas),
 *   igual que hace el bootstrap de pglite en dev.
 * - DEMO_SEED=true → aplica el seed demo (Cevichería El Muelle). Producción
 *   operativa arranca con la DB vacía: el dueño se crea por /signup.
 *
 * Uso: node migrate.mjs   (requiere DATABASE_URL)
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { createDb } from "../src/index";
import { seedDemo } from "../src/local";
import type { LocalDb } from "../src/local";

const here = path.dirname(fileURLToPath(import.meta.url));
// En la imagen: /app/deploy/migrate.mjs → migraciones en /app/packages/db/drizzle
const drizzleDir = process.env.DRIZZLE_DIR ?? path.resolve(here, "..", "packages", "db", "drizzle");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] Falta DATABASE_URL");
  process.exit(1);
}

const db = createDb(url) as unknown as LocalDb;

/** postgres-js devuelve filas como array; pglite como {rows}. Cubre ambos. */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const r = result as { rows?: T[] };
  return r.rows ?? [];
}

function readStatements(file: string): string[] {
  return readFileSync(path.join(drizzleDir, file), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main(): Promise<void> {
  await db.execute(
    sql`create table if not exists rest_migrations (name text primary key, applied_at timestamptz not null default now())`,
  );
  const appliedRows = rowsOf<{ name: string }>(
    await db.execute(sql`select name from rest_migrations`),
  );
  const applied = new Set(appliedRows.map((r) => r.name));

  const files = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql"));
  const schemaFiles = files.filter((f) => !f.includes("rls")).sort();
  const rlsFiles = files.filter((f) => f.includes("rls")).sort();
  const ordered = [...schemaFiles, ...rlsFiles];

  for (const file of ordered) {
    if (applied.has(file)) {
      console.log(`[migrate] = ${file} (ya aplicada)`);
      continue;
    }
    const statements = readStatements(file);
    console.log(`[migrate] > ${file} (${statements.length} statements)`);
    for (const statement of statements) {
      await db.execute(sql.raw(statement));
    }
    await db.execute(sql`insert into rest_migrations (name) values (${file})`);
  }

  if (process.env.DEMO_SEED === "true") {
    const existing = rowsOf(await db.execute(sql`select 1 as one from organizations limit 1`));
    if (existing.length > 0) {
      console.log("[seed] DEMO_SEED=true pero ya existen organizaciones: se omite");
    } else {
      console.log("[seed] aplicando seed demo (Cevichería El Muelle)…");
      await seedDemo(db);
      console.log("[seed] demo lista: maria@cevicheriaelmuelle.pe / demo1234");
    }
  } else {
    console.log("[seed] DEMO_SEED!=true → DB queda vacía (producción operativa)");
  }

  // Superadmin designado: si el usuario ya existe (registrado antes de definir
  // SUPERADMIN_EMAIL), se le otorga el rol; si no existe aún, el signup se lo da.
  const adminEmail = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
  if (adminEmail) {
    await db.execute(
      sql`update users set platform_role = 'superadmin' where lower(email) = ${adminEmail}`,
    );
    console.log(`[superadmin] rol otorgado a ${adminEmail} (si existía)`);
  }

  console.log("[migrate] OK");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[migrate] FALLÓ:", error);
    process.exit(1);
  });
