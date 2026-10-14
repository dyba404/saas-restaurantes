/**
 * Schema multi-tenant — docs/03-arquitectura.md.
 * Reglas:
 *  - Toda tabla del dominio lleva organization_id (tenant) → RLS (ver drizzle/0000_rls.sql).
 *  - Dinero SIEMPRE en centavos (enteros).
 *  - orders.client_uuid: idempotencia del motor offline (packages/sync).
 */
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
  uuid,
} from "drizzle-orm/pg-core";

// ── Enums ───────────────────────────────────────────────────────────────────

export const staffRoleEnum = pgEnum("staff_role", ["owner", "manager", "cashier", "waiter", "kitchen"]);
export const tableStatusEnum = pgEnum("table_status", ["free", "occupied", "bill", "reserved"]);
export const orderChannelEnum = pgEnum("order_channel", [
  "pos",
  "qr",
  "whatsapp",
  "takeaway",
  "rappi",
  "glovo",
  "pedidosya",
  "ubereats",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "open",
  "sent",
  "preparing",
  "ready",
  "served",
  "paid",
  "void",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "mercadopago",
  "stripe",
  "mixed",
  "payment_link",
]);
export const reservationStatusEnum = pgEnum("reservation_status", [
  "pending",
  "confirmed",
  "seated",
  "cancelled",
  "no_show",
]);
export const waDirectionEnum = pgEnum("wa_direction", ["in", "out"]);
export const syncStatusEnum = pgEnum("sync_status", ["pending", "synced", "failed"]);

// ── Tenant y usuarios ───────────────────────────────────────────────────────

/** Organización = restaurante (tenant). Ver docs/03-arquitectura.md §Multi-tenancy. */
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("free"), // free | pro | multi
  /** active | suspended — lo controla el superadmin (/superadmin). */
  status: text("status").notNull().default("active"),
  currency: text("currency").notNull().default("PEN"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Id externo del proveedor de auth (Clerk) — se llena al integrar auth en F0.2. */
  externalId: text("external_id").unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /** scrypt: "salt:hash". Las tablets de local usan PIN aparte (tabla staff). */
  passwordHash: text("password_hash"),
  /** "superadmin" = dueño de la plataforma. null para clientes. Se asigna por
   *  SUPERADMIN_EMAIL (migrador + signup) — nunca por auto-registro. */
  platformRole: text("platform_role"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Auditoría de plataforma: cada acción del superadmin queda registrada
 *  (patrón boxyhq/HPC: actor + acción + objetivo + meta + timestamp). */
export const platformAudit = pgTable("platform_audit", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorEmail: text("actor_email").notNull(),
  /** org.suspend | org.reactivate | org.plan | user.reset_password | user.remove | impersonate.start | impersonate.stop */
  action: text("action").notNull(),
  targetType: text("target_type").notNull(), // organization | user
  targetId: text("target_id"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: staffRoleEnum("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.organizationId] })],
);

/** Local físico (un tenant puede tener 1–5). */
export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    timezone: text("timezone").notNull().default("America/America/Lima"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("locations_org_idx").on(t.organizationId)],
);

/** Empleados del local con PIN (login rápido en POS, hash + rate-limit). */
export const staff = pgTable(
  "staff",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    pinHash: text("pin_hash").notNull(),
    role: staffRoleEnum("role").notNull().default("waiter"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("staff_location_idx").on(t.locationId)],
);

// ── Salón y mesas ───────────────────────────────────────────────────────────

export const diningTables = pgTable(
  "dining_tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    zone: text("zone").notNull().default("salon"),
    /** Coordenadas del plano editable (F2). */
    posX: integer("pos_x").notNull().default(0),
    posY: integer("pos_y").notNull().default(0),
    seats: integer("seats").notNull().default(4),
    status: tableStatusEnum("status").notNull().default("free"),
  },
  (t) => [index("dining_tables_location_idx").on(t.locationId)],
);

// ── Catálogo (fuente de verdad única para POS/QR/WhatsApp/agregadores) ──────

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("categories_org_idx").on(t.organizationId)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    imageUrl: text("image_url"),
    active: boolean("active").notNull().default(true),
    /** Flag "86": activo pero agotado hoy; se propaga a todos los canales. */
    available: boolean("available").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("products_org_idx").on(t.organizationId),
    index("products_category_idx").on(t.categoryId),
  ],
);

export const modifierGroups = pgTable(
  "modifier_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    required: boolean("required").notNull().default(false),
    minSelect: integer("min_select").notNull().default(0),
    maxSelect: integer("max_select").notNull().default(1),
  },
  (t) => [index("modifier_groups_org_idx").on(t.organizationId)],
);

export const modifiers = pgTable(
  "modifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
  },
  (t) => [index("modifiers_group_idx").on(t.groupId)],
);

export const productModifierGroups = pgTable(
  "product_modifier_groups",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    modifierGroupId: uuid("modifier_group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.modifierGroupId] })],
);

// ── Órdenes ─────────────────────────────────────────────────────────────────

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
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
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("orders_client_uuid_unique").on(t.clientUuid),
    index("orders_org_location_idx").on(t.organizationId, t.locationId),
    index("orders_created_idx").on(t.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    /** Snapshot del nombre y precio al momento de la venta (el catálogo puede cambiar). */
    name: text("name").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull(),
    modifiersJson: jsonb("modifiers_json").notNull().default([]),
    notes: text("notes"),
    totalCents: integer("total_cents").notNull().default(0),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    method: paymentMethodEnum("method").notNull(),
    amountCents: integer("amount_cents").notNull(),
    tipCents: integer("tip_cents").notNull().default(0),
    changeCents: integer("change_cents").notNull().default(0),
    /** Referencia externa (MercadoPago/Stripe) en F4; nunca guardamos PAN. */
    externalRef: text("external_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_order_idx").on(t.orderId)],
);

// ── Motor offline: bitácora de sincronización (observabilidad de la cola) ───

export const syncEvents = pgTable(
  "sync_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    deviceFingerprint: text("device_fingerprint").notNull().default("unknown"),
    clientUuid: uuid("client_uuid").notNull(),
    eventType: text("event_type").notNull(),
    status: syncStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    /** Ack persistido: {definitiveNumber?, ...} para re-acks idempotentes. */
    resultJson: jsonb("result_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sync_events_client_uuid_unique").on(t.clientUuid)],
);

// ── Reservas (F3) y clientes/loyalty (F3/F5) ────────────────────────────────

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    tableId: uuid("table_id").references(() => diningTables.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    partySize: integer("party_size").notNull().default(2),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    status: reservationStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
  },
  (t) => [index("reservations_org_start_idx").on(t.organizationId, t.startsAt)],
);

/** Los datos del cliente son del restaurante (promesa anti-lock-in, doc 00). */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    name: text("name"),
    loyaltyPoints: integer("loyalty_points").notNull().default(0),
    lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("customers_org_phone_unique").on(t.organizationId, t.phone)],
);

// ── Auditoría (F4: voids, descuentos, cambios de precio) ────────────────────

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    payloadJson: jsonb("payload_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_org_idx").on(t.organizationId, t.createdAt)],
);

// ── Relaciones ──────────────────────────────────────────────────────────────

export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  payments: many(payments),
  table: one(diningTables, { fields: [orders.tableId], references: [diningTables.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  modifierGroups: many(productModifierGroups),
}));

// ── F2: plataforma SaaS — API pública y webhooks (F5) ───────────────────────

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Prefijo visible (rk_live_abc123…) + hash scrypt del secreto completo. */
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("api_keys_org_idx").on(t.organizationId)],
);

export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    /** Eventos suscritos: ["order.paid", "order.created", …] */
    events: jsonb("events").notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhooks_org_idx").on(t.organizationId)],
);

// ── F3: WhatsApp (Cloud API — mensajes persistidos del tenant) ─────────────

export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** waId del cliente (teléfono). */
    waId: text("wa_id").notNull(),
    direction: waDirectionEnum("direction").notNull(),
    body: text("body").notNull(),
    orderNumber: integer("order_number"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wa_messages_org_wa_idx").on(t.organizationId, t.waId)],
);

// ── F4: inventario de insumos + escandallo ──────────────────────────────────

export const ingredients = pgTable(
  "ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    unit: text("unit").notNull().default("kg"), // kg | l | pza
    stockQty: real("stock_qty").notNull().default(0),
    minQty: real("min_qty").notNull().default(0),
    costPerUnitCents: integer("cost_per_unit_cents").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ingredients_org_idx").on(t.organizationId)],
);

export const recipeItems = pgTable(
  "recipe_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    /** Cantidad del insumo por unidad de producto. */
    qty: real("qty").notNull().default(0),
  },
  (t) => [
    index("recipe_items_org_idx").on(t.organizationId),
    index("recipe_items_product_idx").on(t.productId),
  ],
);

// ── F5: turnos de staff ─────────────────────────────────────────────────────

export const shifts = pgTable(
  "shifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    published: boolean("published").notNull().default(false),
  },
  (t) => [index("shifts_org_start_idx").on(t.organizationId, t.startsAt)],
);

// Tipos inferidos útiles
export type Organization = typeof organizations.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type IngredientRow = typeof ingredients.$inferSelect;

/** Tablet/dispositivo provisionado por el superadmin (auth de las PWA). */
export const devices = pgTable("devices", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("pos"), // pos | kds | menu
  /** Hash scrypt del token (el token en claro se muestra UNA vez al crear). */
  tokenHash: text("token_hash").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
