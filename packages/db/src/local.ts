/**
 * DB local de desarrollo: Postgres REAL embebido (@electric-sql/pglite).
 *
 * - Sin infraestructura: corre in-process, en memoria, y aplica el schema
 *   generado por drizzle-kit + políticas RLS + seed al primer arranque.
 * - El aislamiento multi-tenant es REAL: las queries de dominio corren con
 *   SET LOCAL ROLE app_runtime (no superuser) + app.tenant_id (ver 0000_rls.sql).
 * - Producción (Neon): mismo schema, DATABASE_URL + `drizzle-kit migrate`;
 *   solo cambia la fábrica de cliente, no las queries.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

export type LocalDb = ReturnType<typeof createDrizzle>;
type Pglite = PGlite;

// ── Localizar la carpeta de migraciones desde cualquier cwd ────────────────

function findDrizzleDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "../../packages/db/drizzle"), // apps/* en dev
    path.resolve(process.cwd(), "packages/db/drizzle"), // raíz del monorepo
    path.resolve(process.cwd(), "drizzle"), // packages/db
  ];
  for (const dir of candidates) {
    try {
      if (readdirSync(dir).some((f) => /^\d{4}_.*\.sql$/.test(f))) return dir;
    } catch {
      /* siguiente candidato */
    }
  }
  throw new Error(`No encontré packages/db/drizzle desde cwd=${process.cwd()}`);
}

function readSqlStatements(dir: string, file: string): string[] {
  return readFileSync(path.join(dir, file), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── Hash de PIN/password (scrypt) — compartido con seed y auth ─────────────

export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySecret(secret: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(secret, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && candidate.equals(expected);
}

// ── Bootstrap de la instancia local ────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __restPglite: Pglite | undefined;
}

async function bootstrap(): Promise<Pglite> {
  const client = new PGlite(); // en memoria: demo local, sin archivos ni locks
  const dir = findDrizzleDir();

  // 1) Schema (migraciones generadas por drizzle-kit generate, en orden)
  const schemaFiles = readdirSync(dir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f) && !f.includes("rls"))
    .sort();
  for (const file of schemaFiles) {
    for (const statement of readSqlStatements(dir, file)) {
      await client.exec(statement);
    }
  }

  // 2) RLS + rol runtime + grants (siempre al final: crea policies sobre tablas)
  for (const statement of readSqlStatements(dir, "0000_rls.sql")) {
    await client.exec(statement);
  }

  // 3) Seed demo (como superuser; el runtime NO es superuser)
  await seedDemo(createDrizzle(client));

  return client;
}

/** Singleton: sobrevive al hot-reload de Next dev via globalThis. */
export async function getPglite(): Promise<Pglite> {
  if (!globalThis.__restPglite) {
    globalThis.__restPglite = await bootstrap();
  }
  return globalThis.__restPglite;
}

export async function getLocalDb(): Promise<LocalDb> {
  return drizzle(await getPglite(), { schema });
}

function createDrizzle(client: Pglite) {
  return drizzle(client, { schema });
}

// ── Contextos de ejecución ─────────────────────────────────────────────────

/** Auth: queries sin tenant (users/organizations/memberships), como runtime. */
export async function asRuntime<T>(db: LocalDb, fn: (tx: LocalDb) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE app_runtime`);
    return fn(tx as unknown as LocalDb);
  });
}

/** Dominio: tenant obligatorio → RLS filtra. Sin tenant, 0 filas (fail-closed). */
export async function withTenant<T>(
  db: LocalDb,
  organizationId: string,
  fn: (tx: LocalDb) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${organizationId}, true)`);
    await tx.execute(sql`SET LOCAL ROLE app_runtime`);
    return fn(tx as unknown as LocalDb);
  });
}

// ── Seed demo: Cevichería El Muelle (Lima, Perú) ───────────────────────────

const ORG_SLUG = "cevicheria-el-muelle";

export const DEMO_ORG_SLUG = ORG_SLUG;
export const DEMO_LOGIN = { email: "maria@cevicheriaelmuelle.pe", password: "demo1234" };

/**
 * Datos demo (Cevichería El Muelle). En dev corre siempre contra pglite; en
 * deploy SOLO corre si el migrador se invoca con DEMO_SEED=true — producción
 * arranca con la DB vacía y el dueño se registra por /signup.
 */
export async function seedDemo(db: LocalDb): Promise<void> {

  const [org] = await db
    .insert(schema.organizations)
    .values({ name: "Cevichería El Muelle", slug: ORG_SLUG, plan: "pro", currency: "PEN" })
    .returning();

  const [user] = await db
    .insert(schema.users)
    .values({
      email: DEMO_LOGIN.email,
      name: "María Rodríguez",
      passwordHash: hashSecret(DEMO_LOGIN.password),
    })
    .returning();
  await db.insert(schema.memberships).values({ userId: user.id, organizationId: org.id, role: "owner" });

  const [loc] = await db
    .insert(schema.locations)
    .values({
      organizationId: org.id,
      name: "Barranco",
      address: "Av. Grau 456, Barranco, Lima",
      timezone: "America/Lima",
    })
    .returning();

  await db.insert(schema.staff).values([
    { locationId: loc.id, name: "Ana", pinHash: hashSecret("1234"), role: "waiter" },
    { locationId: loc.id, name: "Luis", pinHash: hashSecret("4321"), role: "waiter" },
    { locationId: loc.id, name: "Sofía", pinHash: hashSecret("1111"), role: "cashier" },
  ]);

  // Mesas: salón, terraza, barra
  const tableRows = await db
    .insert(schema.diningTables)
    .values([
      ...Array.from({ length: 6 }, (_, i) => ({
        organizationId: org.id,
        locationId: loc.id,
        name: `M${i + 1}`,
        zone: "Salón",
        seats: 4,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        organizationId: org.id,
        locationId: loc.id,
        name: `M${i + 7}`,
        zone: "Terraza",
        seats: 6,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        organizationId: org.id,
        locationId: loc.id,
        name: `B${i + 1}`,
        zone: "Barra",
        seats: 2,
      })),
    ])
    .returning();

  const cats = await db
    .insert(schema.categories)
    .values([
      { organizationId: org.id, name: "Ceviches", sortOrder: 0 },
      { organizationId: org.id, name: "Platos de fondo", sortOrder: 1 },
      { organizationId: org.id, name: "Bebidas", sortOrder: 2 },
      { organizationId: org.id, name: "Postres", sortOrder: 3 },
    ])
    .returning();
  const [ceviches, fondos, bebidas, postres] = cats;

  // Grupo de modificadores "¿Cómo lo quieres?" (ceviches) y "servicio" (bebidas)
  const [grupoCeviche] = await db
    .insert(schema.modifierGroups)
    .values({
      organizationId: org.id,
      name: "¿Cómo lo quieres?",
      required: true,
      minSelect: 1,
      maxSelect: 3,
    })
    .returning();
  const modCeviche = await db
    .insert(schema.modifiers)
    .values([
      { groupId: grupoCeviche.id, name: "Con todo", priceCents: 0 },
      { groupId: grupoCeviche.id, name: "Sin cebolla", priceCents: 0 },
      { groupId: grupoCeviche.id, name: "Sin culantro", priceCents: 0 },
      { groupId: grupoCeviche.id, name: "Nivel de ají suave", priceCents: 0 },
      { groupId: grupoCeviche.id, name: "Extra camote", priceCents: 300 },
    ])
    .returning();
  const [grupoBebida] = await db
    .insert(schema.modifierGroups)
    .values({
      organizationId: org.id,
      name: "¿Cómo la servimos?",
      required: true,
      minSelect: 1,
      maxSelect: 1,
    })
    .returning();
  const modBebida = await db
    .insert(schema.modifiers)
    .values([
      { groupId: grupoBebida.id, name: "Fría", priceCents: 0 },
      { groupId: grupoBebida.id, name: "Natural", priceCents: 0 },
    ])
    .returning();

  const products = await db
    .insert(schema.products)
    .values([
      { organizationId: org.id, categoryId: ceviches.id, name: "Ceviche de pescado", description: "Lenguado fresco, leche de tigre, camote y cancha", priceCents: 2_500 },
      { organizationId: org.id, categoryId: ceviches.id, name: "Ceviche mixto", description: "Pescado, calamar y camarón al ajillo", priceCents: 3_200 },
      { organizationId: org.id, categoryId: ceviches.id, name: "Tiradito", description: "Láminas de pescado con leche de tigre y ají amarillo", priceCents: 2_400 },
      { organizationId: org.id, categoryId: ceviches.id, name: "Ceviche de camarones", description: "Camarón de río, choclo y culantro", priceCents: 3_500 },
      { organizationId: org.id, categoryId: fondos.id, name: "Lomo saltado", description: "Res al wok con papas fritas y arroz", priceCents: 2_800 },
      { organizationId: org.id, categoryId: fondos.id, name: "Ají de gallina", description: "Crema de ají amarillo con arroz blanco", priceCents: 2_200 },
      { organizationId: org.id, categoryId: bebidas.id, name: "Chicha morada", description: "Preparada en casa, jarra 600 ml", priceCents: 800 },
      { organizationId: org.id, categoryId: bebidas.id, name: "Inca Kola 500ml", description: "Bien helada", priceCents: 500 },
      { organizationId: org.id, categoryId: bebidas.id, name: "Cerveza artesanal", description: "IPA limeña 355 ml", priceCents: 1_200, available: false },
      { organizationId: org.id, categoryId: postres.id, name: "Picarones", description: "Con miel de chancaca", priceCents: 1_000 },
      { organizationId: org.id, categoryId: postres.id, name: "Suspiro limeño", description: "Manjar blanco y merengue al oporto", priceCents: 1_200 },
    ])
    .returning();

  const byName = (name: string) => products.find((p) => p.name === name)!;
  const cevicheProducts = ["Ceviche de pescado", "Ceviche mixto", "Tiradito", "Ceviche de camarones"];
  await db.insert(schema.productModifierGroups).values(
    cevicheProducts.map((name, i) => ({
      productId: byName(name).id,
      modifierGroupId: grupoCeviche.id,
      sortOrder: i,
    })),
  );
  await db.insert(schema.productModifierGroups).values({
    productId: byName("Chicha morada").id,
    modifierGroupId: grupoBebida.id,
  });

    // Insumos + escandallo de ejemplo (F4)
  const ingredientRows = await db
    .insert(schema.ingredients)
    .values([
      { organizationId: org.id, name: 'Pescado (lenguado)', unit: 'kg', stockQty: 6, minQty: 2, costPerUnitCents: 2_200 },
      { organizationId: org.id, name: 'Cebolla roja', unit: 'kg', stockQty: 10, minQty: 3, costPerUnitCents: 500 },
      { organizationId: org.id, name: 'Camote', unit: 'kg', stockQty: 4, minQty: 2, costPerUnitCents: 400 },
      { organizationId: org.id, name: 'Camarón de río', unit: 'kg', stockQty: 1.5, minQty: 1, costPerUnitCents: 3_800 },
      { organizationId: org.id, name: 'Ají amarillo', unit: 'kg', stockQty: 2, minQty: 1, costPerUnitCents: 900 },
    ])
    .returning();
  const ing = (name: string) => ingredientRows.find((i) => i.name === name)!;
  const cevichePescadoProduct = products.find((p) => p.name === 'Ceviche de pescado')!;
  const cevicheMixtoProduct = products.find((p) => p.name === 'Ceviche mixto')!;
  const tiraditoProduct = products.find((p) => p.name === 'Tiradito')!;
  const camaronesProduct = products.find((p) => p.name === 'Ceviche de camarones')!;
  await db.insert(schema.recipeItems).values([
    { organizationId: org.id, productId: cevichePescadoProduct.id, ingredientId: ing('Pescado (lenguado)').id, qty: 0.15 },
    { organizationId: org.id, productId: cevichePescadoProduct.id, ingredientId: ing('Cebolla roja').id, qty: 0.05 },
    { organizationId: org.id, productId: cevichePescadoProduct.id, ingredientId: ing('Camote').id, qty: 0.1 },
    { organizationId: org.id, productId: cevicheMixtoProduct.id, ingredientId: ing('Pescado (lenguado)').id, qty: 0.12 },
    { organizationId: org.id, productId: cevicheMixtoProduct.id, ingredientId: ing('Camarón de río').id, qty: 0.05 },
    { organizationId: org.id, productId: cevicheMixtoProduct.id, ingredientId: ing('Cebolla roja').id, qty: 0.06 },
    { organizationId: org.id, productId: tiraditoProduct.id, ingredientId: ing('Pescado (lenguado)').id, qty: 0.12 },
    { organizationId: org.id, productId: tiraditoProduct.id, ingredientId: ing('Ají amarillo').id, qty: 0.03 },
    { organizationId: org.id, productId: camaronesProduct.id, ingredientId: ing('Camarón de río').id, qty: 0.15 },
  ]);

  // Clientes con loyalty
  await db.insert(schema.customers).values([
    { organizationId: org.id, phone: "+51 987 654 321", name: "Jorge Quispe", loyaltyPoints: 320, lastVisitAt: new Date() },
    { organizationId: org.id, phone: "+51 912 345 678", name: "Lucía Ramírez", loyaltyPoints: 145 },
    { organizationId: org.id, phone: "+51 954 321 098", name: "Rosa Huamán", loyaltyPoints: 80 },
    { organizationId: org.id, phone: "+51 976 543 210", name: "Diego Vargas", loyaltyPoints: 0 },
  ]);

  // Reservas de hoy
  const today = new Date();
  today.setHours(20, 0, 0, 0);
  const tonight = new Date(today.getTime() + 60 * 60 * 1000);
  await db.insert(schema.reservations).values([
    { organizationId: org.id, locationId: loc.id, tableId: tableRows[8].id, customerName: "Familia Cárdenas", customerPhone: "+51 987 112 233", partySize: 6, startsAt: today, status: "confirmed", notes: "Torta de cumpleaños" },
    { organizationId: org.id, locationId: loc.id, customerName: "Ana Paula", customerPhone: "+51 987 445 566", partySize: 2, startsAt: tonight, status: "pending" },
  ]);

  // Órdenes activas para que el KDS arranque con contenido
  const now = Date.now();
  const activeOrders: Array<{
    number: number;
    channel: "pos" | "qr" | "whatsapp" | "takeaway" | "glovo";
    tableIdx: number | null;
    staffName: string | null;
    minutesAgo: number;
    status: "sent" | "preparing" | "ready";
    items: Array<{ productId: string; name: string; qty: number; unit: number; notes?: string }>;
  }> = [
    {
      number: 508, channel: "pos", tableIdx: 0, staffName: "Luis", minutesAgo: 9, status: "ready",
      items: [
        { productId: byName("Ají de gallina").id, name: "Ají de gallina", qty: 2, unit: 2_200 },
        { productId: byName("Chicha morada").id, name: "Chicha morada", qty: 1, unit: 800 },
      ],
    },
    {
      number: 510, channel: "takeaway", tableIdx: null, staffName: null, minutesAgo: 12, status: "preparing",
      items: [
        { productId: byName("Ceviche mixto").id, name: "Ceviche mixto", qty: 2, unit: 3_200, notes: "sin cebolla" },
        { productId: byName("Tiradito").id, name: "Tiradito", qty: 1, unit: 2_400 },
      ],
    },
    {
      number: 511, channel: "glovo", tableIdx: null, staffName: null, minutesAgo: 6, status: "preparing",
      items: [
        { productId: byName("Picarones").id, name: "Picarones", qty: 1, unit: 1_000 },
        { productId: byName("Ceviche de pescado").id, name: "Ceviche de pescado", qty: 3, unit: 2_500 },
      ],
    },
    {
      number: 512, channel: "qr", tableIdx: 3, staffName: null, minutesAgo: 11, status: "sent",
      items: [
        { productId: byName("Lomo saltado").id, name: "Lomo saltado", qty: 1, unit: 2_800 },
        { productId: byName("Ceviche de pescado").id, name: "Ceviche de pescado", qty: 2, unit: 2_500, notes: "sin culantro" },
      ],
    },
  ];

  for (const o of activeOrders) {
    const subtotal = o.items.reduce((s, it) => s + it.qty * it.unit, 0);
    const createdAt = new Date(now - o.minutesAgo * 60_000);
    const [order] = await db
      .insert(schema.orders)
      .values({
        organizationId: org.id,
        locationId: loc.id,
        clientUuid: crypto.randomUUID(),
        number: o.number,
        channel: o.channel,
        tableId: o.tableIdx != null ? tableRows[o.tableIdx].id : null,
        status: o.status,
        subtotalCents: subtotal,
        totalCents: subtotal,
        createdAt,
        syncedAt: createdAt,
      })
      .returning();
    await db.insert(schema.orderItems).values(
      o.items.map((it) => ({
        orderId: order.id,
        productId: it.productId,
        name: it.name,
        quantity: it.qty,
        unitPriceCents: it.unit,
        totalCents: it.qty * it.unit,
        notes: it.notes,
      })),
    );
  }
}
