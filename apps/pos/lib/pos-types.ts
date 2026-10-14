/**
 * Tipos y modelos de estado propios del POS (carrito, órdenes locales, pagos).
 * Pure TS — sin React — para poder testearlos y reutilizarlos entre tabs.
 */
import type { Modifier, Product } from "@rest/types";

// ── Pagos ───────────────────────────────────────────────────────────────────

export type PaymentMethodUi = "cash" | "card" | "mixed";

/** Resultado del flujo de cobro, listo para encolarse como order.pay. */
export interface PaymentConfirmation {
  method: PaymentMethodUi;
  /** Total cobrado (consumo + propina), en centavos. */
  amountCents: number;
  tipCents: number;
  changeCents: number;
  /** Desglose para mixto (y para el arqueo de caja). */
  cashCents: number;
  cardCents: number;
  reference?: string;
}

export interface SessionPayment {
  id: string;
  ticketNumber: string;
  number?: number;
  provisionalNumber?: number;
  table?: string;
  method: PaymentMethodUi;
  amountCents: number;
  subtotalCents: number;
  tipCents: number;
  changeCents: number;
  cashCents: number;
  cardCents: number;
  /** Efectivo que debería estar en la gaveta tras este pago (arqueo). */
  cashInDrawerCents: number;
  itemsCount: number;
  createdAt: string;
}

// ── Carrito ─────────────────────────────────────────────────────────────────

export interface CartItem {
  key: string;
  product: Product;
  quantity: number;
  modifiers: Modifier[];
  notes?: string;
}

export type CartAction =
  | { type: "add"; product: Product; modifiers: Modifier[] }
  | { type: "inc"; key: string }
  | { type: "dec"; key: string }
  | { type: "setNote"; key: string; notes: string }
  | { type: "clear" };

export function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case "add": {
      const signature = `${action.product.id}|${action.modifiers.map((m) => m.id).join(",")}`;
      const existing = state.find(
        (c) => `${c.product.id}|${c.modifiers.map((m) => m.id).join(",")}` === signature,
      );
      if (existing) {
        return state.map((c) =>
          c === existing ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [
        ...state,
        {
          key: `${signature}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          product: action.product,
          quantity: 1,
          modifiers: action.modifiers,
        },
      ];
    }
    case "inc":
      return state.map((c) =>
        c.key === action.key ? { ...c, quantity: c.quantity + 1 } : c,
      );
    case "dec":
      return state
        .map((c) => (c.key === action.key ? { ...c, quantity: c.quantity - 1 } : c))
        .filter((c) => c.quantity > 0);
    case "setNote":
      return state.map((c) =>
        c.key === action.key ? { ...c, notes: action.notes } : c,
      );
    case "clear":
      return [];
  }
}

/** Precio unitario del renglón incluyendo modificadores (todo en centavos). */
export function cartUnitPriceCents(item: CartItem): number {
  return (
    item.product.priceCents +
    item.modifiers.reduce((sum, m) => sum + m.priceCents, 0)
  );
}

// ── Órdenes ─────────────────────────────────────────────────────────────────

export interface PayableItem {
  productId?: string;
  name: string;
  quantity: number;
  /** Precio unitario con modificadores incluidos, en centavos. */
  unitPriceCents: number;
  modifiers?: string[];
  notes?: string;
}

/**
 * Orden lista para cobrar, desde cualquier origen: el carrito actual (necesita
 * crearse al confirmar), una orden local enviada a cocina o una orden remota.
 */
export interface PayableOrder {
  id: string;
  source: "cart" | "local" | "remote";
  /** true = al confirmar el cobro también se encola order.create. */
  needsCreate: boolean;
  number?: number;
  provisionalNumber?: number;
  channel: string;
  table?: string;
  staffName?: string;
  items: PayableItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

/** Orden creada en esta tablet y aún no pagada. */
export interface LocalOrder {
  clientUuid: string;
  provisionalNumber: number;
  number?: number;
  table?: string;
  items: PayableItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  createdAt: string;
}

export function localOrderToPayable(order: LocalOrder): PayableOrder {
  return {
    id: order.clientUuid,
    source: "local",
    needsCreate: false,
    number: order.number,
    provisionalNumber: order.provisionalNumber,
    channel: "pos",
    table: order.table,
    items: order.items,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
  };
}

// ── Teclado numérico (modelo de captura en centavos) ────────────────────────

/** Cada dígito desplaza en centavos: "1500" → $15.00 (estilo terminal POS). */
export function digitsToCents(digits: string): number {
  if (digits === "") return 0;
  return Number.parseInt(digits, 10);
}

export function pushDigit(digits: string, digit: string, maxDigits = 9): string {
  const next = `${digits}${digit}`;
  return next.length > maxDigits ? digits : next;
}
