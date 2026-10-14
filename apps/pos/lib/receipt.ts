/**
 * Constructores de tickets (ReceiptDocument de @rest/printer) para el POS.
 * La vista previa y la cola de impresión renderizan con renderReceipt(58mm).
 */
import { formatMoney, type ReceiptDocument } from "@rest/printer";
import type { PayableOrder, PaymentConfirmation } from "./pos-types";

/** "#503" con folio definitivo, "L-413" provisional, o "S/FOLIO". */
export function orderTicketNumber(
  order: Pick<PayableOrder, "number" | "provisionalNumber">,
): string {
  if (order.number != null) return `#${order.number}`;
  if (order.provisionalNumber != null) return `L-${order.provisionalNumber}`;
  return "S/FOLIO";
}

function paymentLine(payment: PaymentConfirmation): string {
  switch (payment.method) {
    case "cash": {
      const received = payment.amountCents + payment.changeCents;
      return `Efvo ${formatMoney(received)} · Cambio ${formatMoney(payment.changeCents)}`;
    }
    case "card":
      return `Tarjeta${payment.reference ? ` · Ref ${payment.reference}` : ""}`;
    case "mixed":
      return `Mixto: Efvo ${formatMoney(payment.cashCents)} + Tarj ${formatMoney(payment.cardCents)}`;
  }
}

export interface OrderReceiptInput {
  organizationName: string;
  locationName: string;
  staffName: string;
  order: PayableOrder;
  payment: PaymentConfirmation;
  isoDate: string;
}

export function buildOrderReceipt(input: OrderReceiptInput): ReceiptDocument {
  const { order, payment } = input;
  const hasPrices = order.items.some((item) => item.unitPriceCents > 0);

  let items: ReceiptDocument["items"] = order.items.map((item) => ({
    quantity: item.quantity,
    name: item.name,
    unitPriceCents: item.unitPriceCents,
    totalCents: item.unitPriceCents * item.quantity,
    modifiers: item.modifiers,
    notes: item.notes,
  }));

  // La API de órdenes abiertas puede no traer precios: reparte el total por
  // cantidad para que el ticket sea legible (el TOTAL real siempre es exacto).
  if (!hasPrices && order.totalCents > 0 && items.length > 0) {
    const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0) || 1;
    let assigned = 0;
    items = order.items.map((item, index) => {
      const isLast = index === order.items.length - 1;
      const share = isLast
        ? order.totalCents - assigned
        : Math.round((order.totalCents * item.quantity) / totalQty);
      if (!isLast) assigned += share;
      return {
        quantity: item.quantity,
        name: item.name,
        unitPriceCents: Math.round(share / Math.max(1, item.quantity)),
        totalCents: share,
        modifiers: item.modifiers,
        notes: item.notes,
      };
    });
  }

  if (payment.tipCents > 0) {
    items = [
      ...items,
      {
        quantity: 1,
        name: "Propina",
        unitPriceCents: payment.tipCents,
        totalCents: payment.tipCents,
      },
    ];
  }

  return {
    storeName: input.organizationName,
    locationName: input.locationName,
    ticketNumber: orderTicketNumber(order),
    channel: order.channel,
    table: order.table,
    staffName: input.staffName,
    isoDate: input.isoDate,
    items,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents > 0 ? order.discountCents : undefined,
    totalCents: payment.amountCents,
    paymentLine: paymentLine(payment),
    footer: "¡Gracias por su visita!",
  };
}

export interface CutReceiptInput {
  organizationName: string;
  locationName: string;
  isoDate: string;
  rows: Array<{ label: string; count: number; totalCents: number }>;
  tickets: number;
  totalSalesCents: number;
  expectedCashCents: number;
  countedCents: number | null;
}

/** Corte de turno "X" (sin cierre): desglose por método + arqueo. */
export function buildCutReceipt(input: CutReceiptInput): ReceiptDocument {
  const items: ReceiptDocument["items"] = input.rows
    .filter((row) => row.count > 0 || row.totalCents > 0)
    .map((row) => ({
      quantity: row.count,
      name: row.label,
      unitPriceCents: row.totalCents,
      totalCents: row.totalCents,
    }));
  const paymentParts = [`Esperado en caja: ${formatMoney(input.expectedCashCents)}`];
  if (input.countedCents != null) {
    paymentParts.push(`Contado: ${formatMoney(input.countedCents)}`);
  }
  return {
    storeName: input.organizationName,
    locationName: input.locationName,
    ticketNumber: "CORTE X",
    isoDate: input.isoDate,
    items,
    subtotalCents: input.totalSalesCents,
    totalCents: input.totalSalesCents,
    paymentLine: paymentParts.join(" · "),
    footer: `Corte de turno · ${input.tickets} tickets`,
  };
}
