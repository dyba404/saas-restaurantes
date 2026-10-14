var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// packages/db/scripts/migrate.ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql as sql2 } from "drizzle-orm";

// packages/db/src/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// packages/db/src/schema.ts
var schema_exports = {};
__export(schema_exports, {
  apiKeys: () => apiKeys,
  auditLog: () => auditLog,
  categories: () => categories,
  customers: () => customers,
  diningTables: () => diningTables,
  ingredients: () => ingredients,
  locations: () => locations,
  memberships: () => memberships,
  modifierGroups: () => modifierGroups,
  modifiers: () => modifiers,
  orderChannelEnum: () => orderChannelEnum,
  orderItems: () => orderItems,
  orderItemsRelations: () => orderItemsRelations,
  orderStatusEnum: () => orderStatusEnum,
  orders: () => orders,
  ordersRelations: () => ordersRelations,
  organizations: () => organizations,
  paymentMethodEnum: () => paymentMethodEnum,
  payments: () => payments,
  productModifierGroups: () => productModifierGroups,
  products: () => products,
  productsRelations: () => productsRelations,
  recipeItems: () => recipeItems,
  reservationStatusEnum: () => reservationStatusEnum,
  reservations: () => reservations,
  shifts: () => shifts,
  staff: () => staff,
  staffRoleEnum: () => staffRoleEnum,
  syncEvents: () => syncEvents,
  syncStatusEnum: () => syncStatusEnum,
  tableStatusEnum: () => tableStatusEnum,
  users: () => users,
  waDirectionEnum: () => waDirectionEnum,
  webhooks: () => webhooks,
  whatsappMessages: () => whatsappMessages
});
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
var staffRoleEnum = pgEnum("staff_role", ["owner", "manager", "cashier", "waiter", "kitchen"]);
var tableStatusEnum = pgEnum("table_status", ["free", "occupied", "bill", "reserved"]);
var orderChannelEnum = pgEnum("order_channel", [
  "pos",
  "qr",
  "whatsapp",
  "takeaway",
  "rappi",
  "glovo",
  "pedidosya",
  "ubereats"
]);
var orderStatusEnum = pgEnum("order_status", [
  "open",
  "sent",
  "preparing",
  "ready",
  "served",
  "paid",
  "void"
]);
var paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "mercadopago",
  "stripe",
  "mixed",
  "payment_link"
]);
var reservationStatusEnum = pgEnum("reservation_status", [
  "pending",
  "confirmed",
  "seated",
  "cancelled",
  "no_show"
]);
var waDirectionEnum = pgEnum("wa_direction", ["in", "out"]);
var syncStatusEnum = pgEnum("sync_status", ["pending", "synced", "failed"]);
var organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  // free | pro | multi
  currency: text("currency").notNull().default("PEN"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Id externo del proveedor de auth (Clerk) — se llena al integrar auth en F0.2. */
  externalId: text("external_id").unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /** scrypt: "salt:hash". Las tablets de local usan PIN aparte (tabla staff). */
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    role: staffRoleEnum("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [primaryKey({ columns: [t.userId, t.organizationId] })]
);
var locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    timezone: text("timezone").notNull().default("America/America/Lima"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("locations_org_idx").on(t.organizationId)]
);
var staff = pgTable(
  "staff",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    pinHash: text("pin_hash").notNull(),
    role: staffRoleEnum("role").notNull().default("waiter"),
    active: boolean("active").notNull().default(true)
  },
  (t) => [index("staff_location_idx").on(t.locationId)]
);
var diningTables = pgTable(
  "dining_tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    zone: text("zone").notNull().default("salon"),
    /** Coordenadas del plano editable (F2). */
    posX: integer("pos_x").notNull().default(0),
    posY: integer("pos_y").notNull().default(0),
    seats: integer("seats").notNull().default(4),
    status: tableStatusEnum("status").notNull().default("free")
  },
  (t) => [index("dining_tables_location_idx").on(t.locationId)]
);
var categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true)
  },
  (t) => [index("categories_org_idx").on(t.organizationId)]
);
var products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    imageUrl: text("image_url"),
    active: boolean("active").notNull().default(true),
    /** Flag "86": activo pero agotado hoy; se propaga a todos los canales. */
    available: boolean("available").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("products_org_idx").on(t.organizationId),
    index("products_category_idx").on(t.categoryId)
  ]
);
var modifierGroups = pgTable(
  "modifier_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    required: boolean("required").notNull().default(false),
    minSelect: integer("min_select").notNull().default(0),
    maxSelect: integer("max_select").notNull().default(1)
  },
  (t) => [index("modifier_groups_org_idx").on(t.organizationId)]
);
var modifiers = pgTable(
  "modifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id").notNull().references(() => modifierGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull().default(0)
  },
  (t) => [index("modifiers_group_idx").on(t.groupId)]
);
var productModifierGroups = pgTable(
  "product_modifier_groups",
  {
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    modifierGroupId: uuid("modifier_group_id").notNull().references(() => modifierGroups.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0)
  },
  (t) => [primaryKey({ columns: [t.productId, t.modifierGroupId] })]
);
var orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
    /** Idempotencia offline: UUID v7 generado en el dispositivo. Dedupe server-side. */
    clientUuid: uuid("client_uuid").notNull(),
    /** Folio definitivo; null mientras la orden es offline (folio provisional en el device). */
    number: integer("number"),
    channel: orderChannelEnum("channel").notNull().default("pos"),
    tableId: uuid("table_id").references(() => diningTables.id, { onDelete: "set null" }),
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
    status: orderStatusEnum("status").notNull().default("open"),
    notes: text("notes"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true })
  },
  (t) => [
    uniqueIndex("orders_client_uuid_unique").on(t.clientUuid),
    index("orders_org_location_idx").on(t.organizationId, t.locationId),
    index("orders_created_idx").on(t.createdAt)
  ]
);
var orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    /** Snapshot del nombre y precio al momento de la venta (el catálogo puede cambiar). */
    name: text("name").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull(),
    modifiersJson: jsonb("modifiers_json").notNull().default([]),
    notes: text("notes"),
    totalCents: integer("total_cents").notNull().default(0)
  },
  (t) => [index("order_items_order_idx").on(t.orderId)]
);
var payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    method: paymentMethodEnum("method").notNull(),
    amountCents: integer("amount_cents").notNull(),
    tipCents: integer("tip_cents").notNull().default(0),
    changeCents: integer("change_cents").notNull().default(0),
    /** Referencia externa (MercadoPago/Stripe) en F4; nunca guardamos PAN. */
    externalRef: text("external_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("payments_order_idx").on(t.orderId)]
);
var syncEvents = pgTable(
  "sync_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    deviceFingerprint: text("device_fingerprint").notNull().default("unknown"),
    clientUuid: uuid("client_uuid").notNull(),
    eventType: text("event_type").notNull(),
    status: syncStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    /** Ack persistido: {definitiveNumber?, ...} para re-acks idempotentes. */
    resultJson: jsonb("result_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex("sync_events_client_uuid_unique").on(t.clientUuid)]
);
var reservations = pgTable(
  "reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
    tableId: uuid("table_id").references(() => diningTables.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    partySize: integer("party_size").notNull().default(2),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    status: reservationStatusEnum("status").notNull().default("pending"),
    notes: text("notes")
  },
  (t) => [index("reservations_org_start_idx").on(t.organizationId, t.startsAt)]
);
var customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    name: text("name"),
    loyaltyPoints: integer("loyalty_points").notNull().default(0),
    lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex("customers_org_phone_unique").on(t.organizationId, t.phone)]
);
var auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    payloadJson: jsonb("payload_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("audit_log_org_idx").on(t.organizationId, t.createdAt)]
);
var ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  payments: many(payments),
  table: one(diningTables, { fields: [orders.tableId], references: [diningTables.id] })
}));
var orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] })
}));
var productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  modifierGroups: many(productModifierGroups)
}));
var apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Prefijo visible (rk_live_abc123…) + hash scrypt del secreto completo. */
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("api_keys_org_idx").on(t.organizationId)]
);
var webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    /** Eventos suscritos: ["order.paid", "order.created", …] */
    events: jsonb("events").notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("webhooks_org_idx").on(t.organizationId)]
);
var whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    /** waId del cliente (teléfono). */
    waId: text("wa_id").notNull(),
    direction: waDirectionEnum("direction").notNull(),
    body: text("body").notNull(),
    orderNumber: integer("order_number"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("wa_messages_org_wa_idx").on(t.organizationId, t.waId)]
);
var ingredients = pgTable(
  "ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    unit: text("unit").notNull().default("kg"),
    // kg | l | pza
    stockQty: real("stock_qty").notNull().default(0),
    minQty: real("min_qty").notNull().default(0),
    costPerUnitCents: integer("cost_per_unit_cents").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("ingredients_org_idx").on(t.organizationId)]
);
var recipeItems = pgTable(
  "recipe_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id, { onDelete: "cascade" }),
    /** Cantidad del insumo por unidad de producto. */
    qty: real("qty").notNull().default(0)
  },
  (t) => [
    index("recipe_items_org_idx").on(t.organizationId),
    index("recipe_items_product_idx").on(t.productId)
  ]
);
var shifts = pgTable(
  "shifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    published: boolean("published").notNull().default(false)
  },
  (t) => [index("shifts_org_start_idx").on(t.organizationId, t.startsAt)]
);

// packages/db/src/index.ts
function createDb(url2) {
  const client = postgres(url2, { prepare: false });
  return drizzle(client, { schema: schema_exports });
}

// packages/db/src/local.ts
import { randomBytes, scryptSync } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzle2 } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
function hashSecret(secret) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
var ORG_SLUG = "cevicheria-el-muelle";
var DEMO_LOGIN = { email: "maria@cevicheriaelmuelle.pe", password: "demo1234" };
async function seedDemo(db2) {
  const [org] = await db2.insert(organizations).values({ name: "Cevicher\xEDa El Muelle", slug: ORG_SLUG, plan: "pro", currency: "PEN" }).returning();
  const [user] = await db2.insert(users).values({
    email: DEMO_LOGIN.email,
    name: "Mar\xEDa Rodr\xEDguez",
    passwordHash: hashSecret(DEMO_LOGIN.password)
  }).returning();
  await db2.insert(memberships).values({ userId: user.id, organizationId: org.id, role: "owner" });
  const [loc] = await db2.insert(locations).values({
    organizationId: org.id,
    name: "Barranco",
    address: "Av. Grau 456, Barranco, Lima",
    timezone: "America/Lima"
  }).returning();
  await db2.insert(staff).values([
    { locationId: loc.id, name: "Ana", pinHash: hashSecret("1234"), role: "waiter" },
    { locationId: loc.id, name: "Luis", pinHash: hashSecret("4321"), role: "waiter" },
    { locationId: loc.id, name: "Sof\xEDa", pinHash: hashSecret("1111"), role: "cashier" }
  ]);
  const tableRows = await db2.insert(diningTables).values([
    ...Array.from({ length: 6 }, (_, i) => ({
      organizationId: org.id,
      locationId: loc.id,
      name: `M${i + 1}`,
      zone: "Sal\xF3n",
      seats: 4
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      organizationId: org.id,
      locationId: loc.id,
      name: `M${i + 7}`,
      zone: "Terraza",
      seats: 6
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      organizationId: org.id,
      locationId: loc.id,
      name: `B${i + 1}`,
      zone: "Barra",
      seats: 2
    }))
  ]).returning();
  const cats = await db2.insert(categories).values([
    { organizationId: org.id, name: "Ceviches", sortOrder: 0 },
    { organizationId: org.id, name: "Platos de fondo", sortOrder: 1 },
    { organizationId: org.id, name: "Bebidas", sortOrder: 2 },
    { organizationId: org.id, name: "Postres", sortOrder: 3 }
  ]).returning();
  const [ceviches, fondos, bebidas, postres] = cats;
  const [grupoCeviche] = await db2.insert(modifierGroups).values({
    organizationId: org.id,
    name: "\xBFC\xF3mo lo quieres?",
    required: true,
    minSelect: 1,
    maxSelect: 3
  }).returning();
  const modCeviche = await db2.insert(modifiers).values([
    { groupId: grupoCeviche.id, name: "Con todo", priceCents: 0 },
    { groupId: grupoCeviche.id, name: "Sin cebolla", priceCents: 0 },
    { groupId: grupoCeviche.id, name: "Sin culantro", priceCents: 0 },
    { groupId: grupoCeviche.id, name: "Nivel de aj\xED suave", priceCents: 0 },
    { groupId: grupoCeviche.id, name: "Extra camote", priceCents: 300 }
  ]).returning();
  const [grupoBebida] = await db2.insert(modifierGroups).values({
    organizationId: org.id,
    name: "\xBFC\xF3mo la servimos?",
    required: true,
    minSelect: 1,
    maxSelect: 1
  }).returning();
  const modBebida = await db2.insert(modifiers).values([
    { groupId: grupoBebida.id, name: "Fr\xEDa", priceCents: 0 },
    { groupId: grupoBebida.id, name: "Natural", priceCents: 0 }
  ]).returning();
  const products2 = await db2.insert(products).values([
    { organizationId: org.id, categoryId: ceviches.id, name: "Ceviche de pescado", description: "Lenguado fresco, leche de tigre, camote y cancha", priceCents: 2500 },
    { organizationId: org.id, categoryId: ceviches.id, name: "Ceviche mixto", description: "Pescado, calamar y camar\xF3n al ajillo", priceCents: 3200 },
    { organizationId: org.id, categoryId: ceviches.id, name: "Tiradito", description: "L\xE1minas de pescado con leche de tigre y aj\xED amarillo", priceCents: 2400 },
    { organizationId: org.id, categoryId: ceviches.id, name: "Ceviche de camarones", description: "Camar\xF3n de r\xEDo, choclo y culantro", priceCents: 3500 },
    { organizationId: org.id, categoryId: fondos.id, name: "Lomo saltado", description: "Res al wok con papas fritas y arroz", priceCents: 2800 },
    { organizationId: org.id, categoryId: fondos.id, name: "Aj\xED de gallina", description: "Crema de aj\xED amarillo con arroz blanco", priceCents: 2200 },
    { organizationId: org.id, categoryId: bebidas.id, name: "Chicha morada", description: "Preparada en casa, jarra 600 ml", priceCents: 800 },
    { organizationId: org.id, categoryId: bebidas.id, name: "Inca Kola 500ml", description: "Bien helada", priceCents: 500 },
    { organizationId: org.id, categoryId: bebidas.id, name: "Cerveza artesanal", description: "IPA lime\xF1a 355 ml", priceCents: 1200, available: false },
    { organizationId: org.id, categoryId: postres.id, name: "Picarones", description: "Con miel de chancaca", priceCents: 1e3 },
    { organizationId: org.id, categoryId: postres.id, name: "Suspiro lime\xF1o", description: "Manjar blanco y merengue al oporto", priceCents: 1200 }
  ]).returning();
  const byName = (name) => products2.find((p) => p.name === name);
  const cevicheProducts = ["Ceviche de pescado", "Ceviche mixto", "Tiradito", "Ceviche de camarones"];
  await db2.insert(productModifierGroups).values(
    cevicheProducts.map((name, i) => ({
      productId: byName(name).id,
      modifierGroupId: grupoCeviche.id,
      sortOrder: i
    }))
  );
  await db2.insert(productModifierGroups).values({
    productId: byName("Chicha morada").id,
    modifierGroupId: grupoBebida.id
  });
  const ingredientRows = await db2.insert(ingredients).values([
    { organizationId: org.id, name: "Pescado (lenguado)", unit: "kg", stockQty: 6, minQty: 2, costPerUnitCents: 2200 },
    { organizationId: org.id, name: "Cebolla roja", unit: "kg", stockQty: 10, minQty: 3, costPerUnitCents: 500 },
    { organizationId: org.id, name: "Camote", unit: "kg", stockQty: 4, minQty: 2, costPerUnitCents: 400 },
    { organizationId: org.id, name: "Camar\xF3n de r\xEDo", unit: "kg", stockQty: 1.5, minQty: 1, costPerUnitCents: 3800 },
    { organizationId: org.id, name: "Aj\xED amarillo", unit: "kg", stockQty: 2, minQty: 1, costPerUnitCents: 900 }
  ]).returning();
  const ing = (name) => ingredientRows.find((i) => i.name === name);
  const cevichePescadoProduct = products2.find((p) => p.name === "Ceviche de pescado");
  const cevicheMixtoProduct = products2.find((p) => p.name === "Ceviche mixto");
  const tiraditoProduct = products2.find((p) => p.name === "Tiradito");
  const camaronesProduct = products2.find((p) => p.name === "Ceviche de camarones");
  await db2.insert(recipeItems).values([
    { organizationId: org.id, productId: cevichePescadoProduct.id, ingredientId: ing("Pescado (lenguado)").id, qty: 0.15 },
    { organizationId: org.id, productId: cevichePescadoProduct.id, ingredientId: ing("Cebolla roja").id, qty: 0.05 },
    { organizationId: org.id, productId: cevichePescadoProduct.id, ingredientId: ing("Camote").id, qty: 0.1 },
    { organizationId: org.id, productId: cevicheMixtoProduct.id, ingredientId: ing("Pescado (lenguado)").id, qty: 0.12 },
    { organizationId: org.id, productId: cevicheMixtoProduct.id, ingredientId: ing("Camar\xF3n de r\xEDo").id, qty: 0.05 },
    { organizationId: org.id, productId: cevicheMixtoProduct.id, ingredientId: ing("Cebolla roja").id, qty: 0.06 },
    { organizationId: org.id, productId: tiraditoProduct.id, ingredientId: ing("Pescado (lenguado)").id, qty: 0.12 },
    { organizationId: org.id, productId: tiraditoProduct.id, ingredientId: ing("Aj\xED amarillo").id, qty: 0.03 },
    { organizationId: org.id, productId: camaronesProduct.id, ingredientId: ing("Camar\xF3n de r\xEDo").id, qty: 0.15 }
  ]);
  await db2.insert(customers).values([
    { organizationId: org.id, phone: "+51 987 654 321", name: "Jorge Quispe", loyaltyPoints: 320, lastVisitAt: /* @__PURE__ */ new Date() },
    { organizationId: org.id, phone: "+51 912 345 678", name: "Luc\xEDa Ram\xEDrez", loyaltyPoints: 145 },
    { organizationId: org.id, phone: "+51 954 321 098", name: "Rosa Huam\xE1n", loyaltyPoints: 80 },
    { organizationId: org.id, phone: "+51 976 543 210", name: "Diego Vargas", loyaltyPoints: 0 }
  ]);
  const today = /* @__PURE__ */ new Date();
  today.setHours(20, 0, 0, 0);
  const tonight = new Date(today.getTime() + 60 * 60 * 1e3);
  await db2.insert(reservations).values([
    { organizationId: org.id, locationId: loc.id, tableId: tableRows[8].id, customerName: "Familia C\xE1rdenas", customerPhone: "+51 987 112 233", partySize: 6, startsAt: today, status: "confirmed", notes: "Torta de cumplea\xF1os" },
    { organizationId: org.id, locationId: loc.id, customerName: "Ana Paula", customerPhone: "+51 987 445 566", partySize: 2, startsAt: tonight, status: "pending" }
  ]);
  const now = Date.now();
  const activeOrders = [
    {
      number: 508,
      channel: "pos",
      tableIdx: 0,
      staffName: "Luis",
      minutesAgo: 9,
      status: "ready",
      items: [
        { productId: byName("Aj\xED de gallina").id, name: "Aj\xED de gallina", qty: 2, unit: 2200 },
        { productId: byName("Chicha morada").id, name: "Chicha morada", qty: 1, unit: 800 }
      ]
    },
    {
      number: 510,
      channel: "takeaway",
      tableIdx: null,
      staffName: null,
      minutesAgo: 12,
      status: "preparing",
      items: [
        { productId: byName("Ceviche mixto").id, name: "Ceviche mixto", qty: 2, unit: 3200, notes: "sin cebolla" },
        { productId: byName("Tiradito").id, name: "Tiradito", qty: 1, unit: 2400 }
      ]
    },
    {
      number: 511,
      channel: "glovo",
      tableIdx: null,
      staffName: null,
      minutesAgo: 6,
      status: "preparing",
      items: [
        { productId: byName("Picarones").id, name: "Picarones", qty: 1, unit: 1e3 },
        { productId: byName("Ceviche de pescado").id, name: "Ceviche de pescado", qty: 3, unit: 2500 }
      ]
    },
    {
      number: 512,
      channel: "qr",
      tableIdx: 3,
      staffName: null,
      minutesAgo: 11,
      status: "sent",
      items: [
        { productId: byName("Lomo saltado").id, name: "Lomo saltado", qty: 1, unit: 2800 },
        { productId: byName("Ceviche de pescado").id, name: "Ceviche de pescado", qty: 2, unit: 2500, notes: "sin culantro" }
      ]
    }
  ];
  for (const o of activeOrders) {
    const subtotal = o.items.reduce((s, it) => s + it.qty * it.unit, 0);
    const createdAt = new Date(now - o.minutesAgo * 6e4);
    const [order] = await db2.insert(orders).values({
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
      syncedAt: createdAt
    }).returning();
    await db2.insert(orderItems).values(
      o.items.map((it) => ({
        orderId: order.id,
        productId: it.productId,
        name: it.name,
        quantity: it.qty,
        unitPriceCents: it.unit,
        totalCents: it.qty * it.unit,
        notes: it.notes
      }))
    );
  }
}

// packages/db/scripts/migrate.ts
var here = path.dirname(fileURLToPath(import.meta.url));
var drizzleDir = process.env.DRIZZLE_DIR ?? path.resolve(here, "..", "packages", "db", "drizzle");
var url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] Falta DATABASE_URL");
  process.exit(1);
}
var db = createDb(url);
function rowsOf(result) {
  if (Array.isArray(result)) return result;
  const r = result;
  return r.rows ?? [];
}
function readStatements(file) {
  return readFileSync(path.join(drizzleDir, file), "utf8").split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
}
async function main() {
  await db.execute(
    sql2`create table if not exists rest_migrations (name text primary key, applied_at timestamptz not null default now())`
  );
  const appliedRows = rowsOf(
    await db.execute(sql2`select name from rest_migrations`)
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
      await db.execute(sql2.raw(statement));
    }
    await db.execute(sql2`insert into rest_migrations (name) values (${file})`);
  }
  if (process.env.DEMO_SEED === "true") {
    const existing = rowsOf(await db.execute(sql2`select 1 as one from organizations limit 1`));
    if (existing.length > 0) {
      console.log("[seed] DEMO_SEED=true pero ya existen organizaciones: se omite");
    } else {
      console.log("[seed] aplicando seed demo (Cevicher\xEDa El Muelle)\u2026");
      await seedDemo(db);
      console.log("[seed] demo lista: maria@cevicheriaelmuelle.pe / demo1234");
    }
  } else {
    console.log("[seed] DEMO_SEED!=true \u2192 DB queda vac\xEDa (producci\xF3n operativa)");
  }
  console.log("[migrate] OK");
}
main().then(() => process.exit(0)).catch((error) => {
  console.error("[migrate] FALL\xD3:", error);
  process.exit(1);
});
