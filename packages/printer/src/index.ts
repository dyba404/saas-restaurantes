/**
 * Impresión térmica ESC/POS — docs/03-arquitectura.md §Impresión térmica.
 *
 * Capa 1 (este package, puro y testeable): modelo de ticket + layout por ancho
 * de papel (32 chars 58mm / 48 chars 80mm).
 * Capa 2 (F1, en apps/pos): encoding y transporte con las librerías MIT de
 * Niels Leenheer — `@point-of-sale/receipt-printer-encoder` (ESC/POS, StarPRNT)
 * + WebBluetooth/WebUSB/WebSerialReceiptPrinter como transports del navegador.
 */

export const PAPER_WIDTHS = { mm58: 32, mm80: 48 } as const;
export type PaperWidth = keyof typeof PAPER_WIDTHS;

export type TextStyle = "normal" | "bold";

export interface ReceiptTextLine {
  text: string;
  style?: TextStyle;
  align?: "left" | "center" | "right";
}

/** Par nombre→valor en una misma fila (ej: "3x Ceviche     S/ 25.00"). */
export interface ReceiptColumnsLine {
  left: string;
  right: string;
  style?: TextStyle;
}

export type ReceiptLine = ReceiptTextLine | ReceiptColumnsLine;

export interface ReceiptDocument {
  storeName: string;
  locationName?: string;
  /** Folio definitivo o provisional "L-0412". */
  ticketNumber: string;
  channel?: string;
  table?: string;
  staffName?: string;
  isoDate: string;
  items: Array<{
    quantity: number;
    name: string;
    unitPriceCents: number;
    totalCents: number;
    modifiers?: string[];
    notes?: string;
  }>;
  subtotalCents: number;
  discountCents?: number;
  totalCents: number;
  paymentLine?: string;
  footer?: string;
  /** QR del ticket/factura (cumplimiento fiscal F5). */
  qrText?: string;
}

/** Localización del producto: Perú (es-PE / PEN, "S/ 12.50"). */
export const LOCALE = "es-PE" as const;
export const CURRENCY = "PEN" as const;

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY }).format(
    cents / 100,
  );
}

function renderLine(line: ReceiptLine, width: number): string {
  if ("left" in line) {
    const space = Math.max(1, width - line.left.length - line.right.length);
    return (line.left + " ".repeat(space) + line.right).slice(0, width);
  }
  const raw = line.text.slice(0, width);
  const missing = width - raw.length;
  if (line.align === "right") return " ".repeat(missing) + raw;
  if (line.align === "center") return " ".repeat(Math.floor(missing / 2)) + raw;
  return raw;
}

/** Genera las líneas de texto del ticket (layout puro, sin comandos de printer). */
export function renderReceipt(doc: ReceiptDocument, paper: PaperWidth = "mm58"): string[] {
  const width = PAPER_WIDTHS[paper];
  const out: ReceiptLine[] = [];
  const text = (line: ReceiptTextLine) => out.push(line);
  const cols = (line: ReceiptColumnsLine) => out.push(line);

  text({ text: doc.storeName, style: "bold", align: "center" });
  if (doc.locationName) text({ text: doc.locationName, align: "center" });
  text({ text: `Ticket: ${doc.ticketNumber}`, style: "bold" });
  const meta = [
    doc.channel ? `Canal: ${doc.channel}` : null,
    doc.table ? `Mesa: ${doc.table}` : null,
    doc.staffName ? `Atendió: ${doc.staffName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (meta) text({ text: meta });
  text({ text: new Date(doc.isoDate).toLocaleString(LOCALE) });
  text({ text: "-".repeat(width) });

  for (const item of doc.items) {
    cols({ left: `${item.quantity}x ${item.name}`, right: formatMoney(item.totalCents) });
    for (const modifier of item.modifiers ?? []) text({ text: `   + ${modifier}` });
    if (item.notes) text({ text: `   * ${item.notes}` });
  }

  text({ text: "-".repeat(width) });
  cols({ left: "Subtotal", right: formatMoney(doc.subtotalCents) });
  if (doc.discountCents && doc.discountCents > 0) {
    cols({ left: "Descuento", right: `-${formatMoney(doc.discountCents)}` });
  }
  cols({ left: "TOTAL", right: formatMoney(doc.totalCents), style: "bold" });
  if (doc.paymentLine) text({ text: doc.paymentLine });
  if (doc.footer) text({ text: doc.footer, align: "center" });
  if (doc.qrText) text({ text: `[QR] ${doc.qrText}`, align: "center" });

  return out.map((line) => renderLine(line, width));
}

// ── Transportes (implementación real en F1 sobre @point-of-sale) ────────────

export interface PrintTransport {
  readonly kind: "bluetooth" | "usb" | "serial" | "network";
  isAvailable(): boolean;
  /** Envía bytes ESC/POS ya codificados. La cola con reintentos vive en la app. */
  print(bytes: Uint8Array): Promise<void>;
}

/** Detección de soporte del navegador (Web Bluetooth solo Android/Chrome/Edge). */
export function bluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}
export function usbSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}
export function serialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

/** Transporte que cumple PrintTransport sin tocar hardware (tests / demo). */
export class NullTransport implements PrintTransport {
  readonly kind = "bluetooth" as const;
  isAvailable(): boolean {
    return true;
  }
  async print(): Promise<void> {
    /* no-op */
  }
}
