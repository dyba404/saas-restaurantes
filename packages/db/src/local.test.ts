/**
 * Tests de aislamiento multi-tenant (RLS) REALES sobre PGlite en proceso.
 *
 * Arranque idéntico al de src/local.ts (migraciones de drizzle/ + 0000_rls.sql
 * con rol `app_runtime` no-superuser + `app.tenant_id`), pero SIN seed demo:
 * cada test monta sus propios datos en un beforeEach con DB fresca.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, inArray, sql } from "drizzle-orm";
import * as schema from "./schema";
import { asRuntime, hashSecret, verifySecret, withTenant, type LocalDb } from "./local";

// ── Bootstrap (misma receta que bootstrap() en local.ts, sin seed) ──────────

const DRIZZLE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

function readSql(file: string): string[] {
  return readFileSync(path.join(DRIZZLE_DIR, file), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function bootDb(): Promise<{ client: PGlite; db: LocalDb }> {
  const client = new PGlite(); // en memoria: una DB aislada por test
  const schemaFiles = readdirSync(DRIZZLE_DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f) && !f.includes("rls"))
    .sort();
  for (const file of schemaFiles) {
    for (const statement of readSql(file)) await client.exec(statement);
  }
  for (const statement of readSql("0000_rls.sql")) await client.exec(statement);
  const db = drizzle(client, { schema });
  return { client, db };
}

/** Sesión runtime con app.user_id (mismo patrón que asRuntime/withTenant). */
async function asUser<T>(db: LocalDb, userId: string, fn: (tx: LocalDb) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
    await tx.execute(sql`SET LOCAL ROLE app_runtime`);
    return fn(tx as unknown as LocalDb);
  });
}

/**
 * Drizzle envuelve el error de Postgres en DrizzleQueryError ("Failed query…")
 * y la violación RLS real vive en `cause`. Recorremos la cadena completa para
 * afirmar que el rechazo ES por row-level security (y no por otra cosa).
 */
async function expectRlsViolation(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const messages: string[] = [];
    let current: unknown = error;
    while (current instanceof Error) {
      messages.push(current.message);
      current = (current as { cause?: unknown }).cause;
    }
    expect(messages.join(" | ")).toMatch(/row-level security/i);
    return;
  }
  throw new Error("La operación debió ser rechazada por RLS, pero triunfó");
}

// ── Fixture: dos organizaciones con datos propios (inserts directos) ────────

interface Fixture {
  orgA: schema.Organization;
  orgB: schema.Organization;
  productA: schema.ProductRow[];
  productB: schema.ProductRow[];
  customerA: Array<typeof schema.customers.$inferSelect>;
  customerB: Array<typeof schema.customers.$inferSelect>;
  orderA: schema.OrderRow;
  orderAItems: Array<typeof schema.orderItems.$inferSelect>;
  orderB: schema.OrderRow[];
  staffA: Array<typeof schema.staff.$inferSelect>;
  staffB: Array<typeof schema.staff.$inferSelect>;
  userA: typeof schema.users.$inferSelect;
}

async function seedFixture(db: LocalDb): Promise<Fixture> {
  const [orgA] = await db
    .insert(schema.organizations)
    .values({ name: "Cevichería La Mar", slug: "la-mar", currency: "PEN" })
    .returning();
  const [orgB] = await db
    .insert(schema.organizations)
    .values({ name: "Pizzería Napoli", slug: "napoli", currency: "PEN" })
    .returning();

  const [locA] = await db
    .insert(schema.locations)
    .values({ organizationId: orgA.id, name: "Miraflores" })
    .returning();
  const [locB] = await db
    .insert(schema.locations)
    .values({ organizationId: orgB.id, name: "Centro" })
    .returning();

  const [catA] = await db
    .insert(schema.categories)
    .values({ organizationId: orgA.id, name: "Marinos" })
    .returning();
  const [catB] = await db
    .insert(schema.categories)
    .values({ organizationId: orgB.id, name: "Pizzas" })
    .returning();

  const productA = await db
    .insert(schema.products)
    .values([
      { organizationId: orgA.id, categoryId: catA.id, name: "Ceviche clásico", priceCents: 2_800 },
      { organizationId: orgA.id, categoryId: catA.id, name: "Lomo saltado", priceCents: 2_200 },
    ])
    .returning();
  const productB = await db
    .insert(schema.products)
    .values([
      { organizationId: orgB.id, categoryId: catB.id, name: "Margherita", priceCents: 3_000 },
      { organizationId: orgB.id, categoryId: catB.id, name: "Diavola", priceCents: 3_500 },
      { organizationId: orgB.id, categoryId: catB.id, name: "Cuatro quesos", priceCents: 3_800 },
    ])
    .returning();

  const customerA = await db
    .insert(schema.customers)
    .values([
      { organizationId: orgA.id, phone: "+51 987 111 222", name: "Ana Torres" },
      { organizationId: orgA.id, phone: "+51 987 333 444", name: "Luis Peña" },
    ])
    .returning();
  const customerB = await db
    .insert(schema.customers)
    .values([{ organizationId: orgB.id, phone: "+51 955 000 111", name: "Rosa Vidal" }])
    .returning();

  const [orderA] = await db
    .insert(schema.orders)
    .values({
      organizationId: orgA.id,
      locationId: locA.id,
      clientUuid: crypto.randomUUID(),
      number: 1001,
      channel: "pos",
      status: "paid",
      subtotalCents: 5_000,
      totalCents: 5_000,
    })
    .returning();
  const orderAItems = await db
    .insert(schema.orderItems)
    .values([
      { orderId: orderA.id, productId: productA[0].id, name: "Ceviche clásico", quantity: 1, unitPriceCents: 2_800, totalCents: 2_800 },
      { orderId: orderA.id, productId: productA[1].id, name: "Lomo saltado", quantity: 1, unitPriceCents: 2_200, totalCents: 2_200 },
    ])
    .returning();

  const orderB = await db
    .insert(schema.orders)
    .values([
      {
        organizationId: orgB.id,
        locationId: locB.id,
        clientUuid: crypto.randomUUID(),
        number: 2001,
        channel: "pos",
        status: "open",
        subtotalCents: 3_000,
        totalCents: 3_000,
      },
      {
        organizationId: orgB.id,
        locationId: locB.id,
        clientUuid: crypto.randomUUID(),
        number: 2002,
        channel: "takeaway",
        status: "sent",
        subtotalCents: 3_500,
        totalCents: 3_500,
      },
    ])
    .returning();

  const staffA = await db
    .insert(schema.staff)
    .values([{ locationId: locA.id, name: "Marta", pinHash: hashSecret("1111"), role: "waiter" }])
    .returning();
  const staffB = await db
    .insert(schema.staff)
    .values([
      { locationId: locB.id, name: "Paolo", pinHash: hashSecret("2222"), role: "cashier" },
      { locationId: locB.id, name: "Gina", pinHash: hashSecret("3333"), role: "kitchen" },
    ])
    .returning();

  const [userA] = await db
    .insert(schema.users)
    .values({
      email: "ana@lamar.pe",
      name: "Ana Torres",
      passwordHash: hashSecret("clave-correcta"),
    })
    .returning();
  const [userB] = await db
    .insert(schema.users)
    .values({
      email: "paolo@napoli.pe",
      name: "Paolo Rossi",
      passwordHash: hashSecret("otra-clave"),
    })
    .returning();
  await db.insert(schema.memberships).values([
    { userId: userA.id, organizationId: orgA.id, role: "owner" },
    { userId: userB.id, organizationId: orgB.id, role: "owner" },
  ]);

  return {
    orgA,
    orgB,
    productA,
    productB,
    customerA,
    customerB,
    orderA,
    orderAItems,
    orderB,
    staffA,
    staffB,
    userA,
  };
}

// ── Setup/teardown: DB fresca por test ──────────────────────────────────────

let client: PGlite | undefined;
let db: LocalDb;
let fx: Fixture;

beforeEach(async () => {
  const booted = await bootDb();
  client = booted.client;
  db = booted.db;
  fx = await seedFixture(db);
});

afterEach(async () => {
  await client?.close();
  client = undefined;
});

// ── RLS: SELECT ─────────────────────────────────────────────────────────────

describe("RLS multi-tenant — SELECT", () => {
  it("con app.tenant_id=orgA, orders/products/customers devuelven SOLO filas de orgA (counts exactos)", async () => {
    const res = await withTenant(db, fx.orgA.id, async (tx) => ({
      orders: await tx.select().from(schema.orders),
      products: await tx.select().from(schema.products),
      customers: await tx.select().from(schema.customers),
    }));

    // Counts exactos: orgA tiene 1 orden / 2 productos / 2 clientes; orgB 2/3/1.
    expect(res.orders).toHaveLength(1);
    expect(res.products).toHaveLength(2);
    expect(res.customers).toHaveLength(2);

    // Nunca aparecen filas de orgB.
    expect(res.orders.every((o) => o.organizationId === fx.orgA.id)).toBe(true);
    expect(res.products.every((p) => p.organizationId === fx.orgA.id)).toBe(true);
    expect(res.customers.every((c) => c.organizationId === fx.orgA.id)).toBe(true);
    expect(res.orders.map((o) => o.number)).toEqual([1001]);
    expect(res.customers.map((c) => c.name).sort()).toEqual(["Ana Torres", "Luis Peña"]);
  });

  it("con app.tenant_id=orgB ve las SUYAS (y ninguna de orgA): aislamiento simétrico", async () => {
    const res = await withTenant(db, fx.orgB.id, async (tx) => ({
      orders: await tx.select().from(schema.orders),
      products: await tx.select().from(schema.products),
      customers: await tx.select().from(schema.customers),
    }));

    expect(res.orders).toHaveLength(2);
    expect(res.products).toHaveLength(3);
    expect(res.customers).toHaveLength(1);
    expect(res.orders.every((o) => o.organizationId === fx.orgB.id)).toBe(true);
    expect(res.products.every((p) => p.organizationId === fx.orgB.id)).toBe(true);
    expect(res.customers[0].organizationId).toBe(fx.orgB.id);
  });

  it("fail-closed: sin app.tenant_id, el rol runtime ve 0 filas de dominio", async () => {
    const res = await asRuntime(db, async (tx) => ({
      orders: await tx.select().from(schema.orders),
      products: await tx.select().from(schema.products),
      customers: await tx.select().from(schema.customers),
      locations: await tx.select().from(schema.locations),
    }));
    expect(res.orders).toHaveLength(0);
    expect(res.products).toHaveLength(0);
    expect(res.customers).toHaveLength(0);
    expect(res.locations).toHaveLength(0);
  });

  it("tablas anidadas: order_items heredan el tenant de su order", async () => {
    const visible = await withTenant(db, fx.orgA.id, (tx) =>
      tx
        .select()
        .from(schema.orderItems)
        .where(
          inArray(
            schema.orderItems.orderId,
            [fx.orderA.id, ...fx.orderB.map((o) => o.id)],
          ),
        ),
    );
    // Los 2 ítems son de la orden de orgA; los ítems huérfanos de orgB ni existen.
    expect(visible).toHaveLength(2);
    expect(visible.every((i) => i.orderId === fx.orderA.id)).toBe(true);
  });

  it("tablas bajo location: staff se aísla vía location.organization_id", async () => {
    const staffA = await withTenant(db, fx.orgA.id, (tx) => tx.select().from(schema.staff));
    const staffB = await withTenant(db, fx.orgB.id, (tx) => tx.select().from(schema.staff));
    expect(staffA.map((s) => s.name)).toEqual(["Marta"]);
    expect(staffB.map((s) => s.name).sort()).toEqual(["Gina", "Paolo"]);
  });
});

// ── RLS: INSERT / UPDATE / DELETE ───────────────────────────────────────────

describe("RLS multi-tenant — escrituras", () => {
  it("INSERT con tenant propio funciona (control positivo)", async () => {
    const inserted = await withTenant(db, fx.orgA.id, (tx) =>
      tx
        .insert(schema.customers)
        .values({ organizationId: fx.orgA.id, phone: "+51 900 000 001", name: "Nuevo" })
        .returning(),
    );
    expect(inserted).toHaveLength(1);
    expect(inserted[0].organizationId).toBe(fx.orgA.id);
  });

  it("INSERT con tenant_id ajeno (orgB desde sesión orgA) es rechazado por WITH CHECK", async () => {
    await expectRlsViolation(
      withTenant(db, fx.orgA.id, (tx) =>
        tx
          .insert(schema.products)
          .values({
            organizationId: fx.orgB.id,
            categoryId: fx.productB[0].categoryId,
            name: "Producto intruso",
            priceCents: 100,
          })
          .returning(),
      ),
    );
  });

  it("INSERT anidado apuntando a una order ajena también es rechazado", async () => {
    await expectRlsViolation(
      withTenant(db, fx.orgA.id, (tx) =>
        tx
          .insert(schema.orderItems)
          .values({
            orderId: fx.orderB[0].id,
            name: "Ítem intruso",
            quantity: 1,
            unitPriceCents: 100,
            totalCents: 100,
          })
          .returning(),
      ),
    );
  });

  it("UPDATE y DELETE cruzados afectan 0 filas (y orgB queda intacta)", async () => {
    const res = await withTenant(db, fx.orgA.id, async (tx) => ({
      updated: await tx
        .update(schema.products)
        .set({ priceCents: 1 })
        .where(inArray(schema.products.id, fx.productB.map((p) => p.id)))
        .returning({ id: schema.products.id }),
      deleted: await tx
        .delete(schema.orders)
        .where(inArray(schema.orders.id, fx.orderB.map((o) => o.id)))
        .returning({ id: schema.orders.id }),
    }));
    expect(res.updated).toHaveLength(0);
    expect(res.deleted).toHaveLength(0);

    // Como superuser: orgB sigue igual (precios intactos, órdenes vivas).
    const productsB = await db
      .select()
      .from(schema.products)
      .where(inArray(schema.products.id, fx.productB.map((p) => p.id)));
    expect(productsB.map((p) => p.priceCents).sort()).toEqual([3_000, 3_500, 3_800]);
    const ordersB = await db
      .select({ id: schema.orders.id })
      .from(schema.orders)
      .where(eq(schema.orders.organizationId, fx.orgB.id));
    expect(ordersB).toHaveLength(2);
  });

  it("UPDATE del tenant propio sí modifica (control positivo)", async () => {
    const updated = await withTenant(db, fx.orgA.id, (tx) =>
      tx
        .update(schema.products)
        .set({ priceCents: 9_999 })
        .where(eq(schema.products.id, fx.productA[0].id))
        .returning({ id: schema.products.id }),
    );
    expect(updated).toHaveLength(1);
    const [after] = await db.select().from(schema.products).where(eq(schema.products.id, fx.productA[0].id));
    expect(after.priceCents).toBe(9_999);
  });
});

// ── Memberships (app.user_id) ────────────────────────────────────────────────

describe("RLS — memberships por app.user_id", () => {
  it("runtime sin app.user_id no ve ninguna membresía (fail-closed)", async () => {
    const rows = await asRuntime(db, (tx) => tx.select().from(schema.memberships));
    expect(rows).toHaveLength(0);
  });

  it("con app.user_id=userA solo ve sus propias membresías", async () => {
    const rows = await asUser(db, fx.userA.id, (tx) => tx.select().from(schema.memberships));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(fx.userA.id);
    expect(rows[0].organizationId).toBe(fx.orgA.id);
  });
});

// ── Auth (scrypt, helpers de local.ts) ───────────────────────────────────────

describe("auth — scrypt (hashSecret/verifySecret)", () => {
  it("hash+verify roundtrip: clave correcta pasa, incorrecta falla", () => {
    const stored = hashSecret("clave-correcta");
    expect(verifySecret("clave-correcta", stored)).toBe(true);
    expect(verifySecret("clave-incorrecta", stored)).toBe(false);
  });

  it("hashes con salt aleatorio: dos hashes del mismo secret difieren pero ambos verifican", () => {
    const h1 = hashSecret("mismo-secret");
    const h2 = hashSecret("mismo-secret");
    expect(h1).not.toBe(h2);
    expect(verifySecret("mismo-secret", h1)).toBe(true);
    expect(verifySecret("mismo-secret", h2)).toBe(true);
  });

  it("stored malformado no revienta: devuelve false", () => {
    expect(verifySecret("x", "")).toBe(false);
    expect(verifySecret("x", "sin-formato")).toBe(false);
    expect(verifySecret("x", "zz:no-hex")).toBe(false);
  });

  it("login simulado: el runtime encuentra el user por email (sin RLS en auth) y el password verifica", async () => {
    const found = await asRuntime(db, (tx) =>
      tx.select().from(schema.users).where(eq(schema.users.email, "ana@lamar.pe")),
    );
    expect(found).toHaveLength(1);
    expect(found[0].email).toBe("ana@lamar.pe");
    // Login correcto / incorrecto sobre el hash persistido.
    expect(verifySecret("clave-correcta", found[0].passwordHash!)).toBe(true);
    expect(verifySecret("clave-incorrecta", found[0].passwordHash!)).toBe(false);
  });
});
