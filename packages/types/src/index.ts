/**
 * Contratos de dominio compartidos entre POS, KDS, menú QR, admin y API.
 * Fuente de verdad única: ver docs/03-arquitectura.md (principio 2).
 */
import { z } from "zod";

export * from "./locale";

// ── Enums de dominio ────────────────────────────────────────────────────────

export const ORDER_CHANNELS = [
  "pos",
  "qr",
  "whatsapp",
  "takeaway",
  "rappi",
  "glovo",
  "pedidosya",
  "ubereats",
] as const;
export const orderChannelSchema = z.enum(ORDER_CHANNELS);
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

/** Estados de la orden en el ciclo completo (POS → KDS → pago). */
export const ORDER_STATUSES = [
  "open",
  "sent",
  "preparing",
  "ready",
  "served",
  "paid",
  "void",
] as const;
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Estados de una orden desde el punto de vista de cocina (KDS). */
export const KDS_STATUSES = ["new", "preparing", "ready", "served"] as const;
export const kdsStatusSchema = z.enum(KDS_STATUSES);
export type KdsStatus = (typeof KDS_STATUSES)[number];

export const STAFF_ROLES = ["owner", "manager", "cashier", "waiter", "kitchen"] as const;
export const staffRoleSchema = z.enum(STAFF_ROLES);
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PAYMENT_METHODS = [
  "cash",
  "card",
  "mercadopago",
  "stripe",
  "mixed",
  "payment_link",
] as const;
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const TABLE_STATUSES = ["free", "occupied", "bill", "reserved"] as const;
export const tableStatusSchema = z.enum(TABLE_STATUSES);
export type TableStatus = (typeof TABLE_STATUSES)[number];

// ── Catálogo ────────────────────────────────────────────────────────────────

export const modifierSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  priceCents: z.number().int().nonnegative().default(0),
});
export type Modifier = z.infer<typeof modifierSchema>;

export const modifierGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  /** true = el cliente/mesero DEBE elegir (min/max selects). */
  required: z.boolean().default(false),
  minSelect: z.number().int().nonnegative().default(0),
  maxSelect: z.number().int().positive().default(1),
  modifiers: z.array(modifierSchema).min(1),
});
export type ModifierGroup = z.infer<typeof modifierGroupSchema>;

export const productSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  priceCents: z.number().int().positive(),
  imageUrl: z.string().optional(),
  modifierGroups: z.array(modifierGroupSchema).default([]),
  /** activo = se vende y aparece en todos los canales. */
  active: z.boolean().default(true),
  /** disponible = flag "86" en un toque; activo pero agotado hoy. */
  available: z.boolean().default(true),
});
export type Product = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});
export type Category = z.infer<typeof categorySchema>;

// ── Órdenes ─────────────────────────────────────────────────────────────────

export const orderItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  modifiers: z.array(modifierSchema).default([]),
  notes: z.string().optional(),
  totalCents: z.number().int().nonnegative(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderSchema = z.object({
  id: z.string(),
  /** Idempotencia offline: generado en el dispositivo (UUID v7), dedupe en servidor. */
  clientUuid: z.uuid(),
  organizationId: z.string(),
  locationId: z.string(),
  /** Folio definitivo (server). El POS usa provisionalNumber mientras sincroniza. */
  number: z.number().int().positive().optional(),
  provisionalNumber: z.number().int().positive().optional(),
  channel: orderChannelSchema,
  tableId: z.string().optional(),
  staffName: z.string().optional(),
  status: orderStatusSchema,
  items: z.array(orderItemSchema).min(1),
  subtotalCents: z.number().int().nonnegative(),
  discountCents: z.number().int().nonnegative().default(0),
  totalCents: z.number().int().nonnegative(),
  notes: z.string().optional(),
  createdAt: z.string(),
  syncedAt: z.string().optional(),
});
export type Order = z.infer<typeof orderSchema>;

export const paymentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  method: paymentMethodSchema,
  amountCents: z.number().int().nonnegative(),
  tipCents: z.number().int().nonnegative().default(0),
  changeCents: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
});
export type Payment = z.infer<typeof paymentSchema>;

// ── Utilidades de cálculo (compartidas POS ↔ QR ↔ WhatsApp) ────────────────

export function orderItemTotalCents(
  item: Pick<OrderItem, "quantity" | "unitPriceCents" | "modifiers">,
): number {
  const modifiersCents = item.modifiers.reduce((sum, m) => sum + m.priceCents, 0);
  return item.quantity * (item.unitPriceCents + modifiersCents);
}

export function orderTotalsCents(items: OrderItem[], discountCents = 0) {
  const subtotalCents = items.reduce((sum, item) => sum + orderItemTotalCents(item), 0);
  return {
    subtotalCents,
    discountCents,
    totalCents: Math.max(0, subtotalCents - discountCents),
  };
}
