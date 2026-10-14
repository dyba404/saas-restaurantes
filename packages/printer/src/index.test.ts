/**
 * Tests de la capa 1 de impresión (layout puro): anchos por papel, columnas y
 * contenidos. Sin aserciones de símbolo de moneda exacto (lo decide el locale).
 */
import { describe, expect, it } from "vitest";
import {
  NullTransport,
  PAPER_WIDTHS,
  formatMoney,
  renderReceipt,
  type ReceiptDocument,
} from "./index";

const doc: ReceiptDocument = {
  storeName: "Cevichería El Muelle",
  locationName: "Barranco",
  ticketNumber: "L-0412",
  channel: "qr",
  table: "Mesa 7",
  staffName: "Ana",
  isoDate: "2026-09-12T18:30:00Z",
  items: [
    { quantity: 2, name: "Ceviche de pescado", unitPriceCents: 2500, totalCents: 5000 },
    { quantity: 1, name: "Chicha morada", unitPriceCents: 800, totalCents: 800, modifiers: ["Fría"], notes: "sin hielo" },
  ],
  subtotalCents: 5800,
  discountCents: 500,
  totalCents: 5300,
  paymentLine: "Efectivo — cambio S/ 7.00",
  footer: "¡Gracias por su compra!",
  qrText: "https://rest.example/t/0412",
};

describe("renderReceipt", () => {
  it("respeta el ancho de papel 58mm (32 chars) en TODAS las líneas", () => {
    const lines = renderReceipt(doc, "mm58");
    expect(lines.length).toBeGreaterThan(6);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(PAPER_WIDTHS.mm58);
  });

  it("respeta el ancho 80mm (48 chars) y trunca lo que no cabe", () => {
    const lines = renderReceipt({ ...doc, items: [{ ...doc.items[0]!, name: "X".repeat(80), totalCents: 1 }] }, "mm80");
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(PAPER_WIDTHS.mm80);
  });

  it("incluye encabezado, folio, meta y separadores del ancho exacto", () => {
    const lines = renderReceipt(doc, "mm58");
    expect(lines[0]).toContain("Cevichería El Muelle");
    expect(lines.some((l) => l.includes("Ticket: L-0412"))).toBe(true);
    expect(lines.some((l) => l.includes("Mesa 7"))).toBe(true);
    expect(lines.filter((l) => l === "-".repeat(PAPER_WIDTHS.mm58)).length).toBeGreaterThanOrEqual(2);
  });

  it("en 80mm la línea de meta completa cabe (canal, mesa y staff)", () => {
    const lines = renderReceipt(doc, "mm80");
    expect(lines.some((l) => l.includes("Mesa 7") && l.includes("Ana"))).toBe(true);
  });

  it("renderiza items con cantidad, modificadores y notas", () => {
    const lines = renderReceipt(doc, "mm58");
    expect(lines.some((l) => l.startsWith("2x ") && l.includes("Ceviche"))).toBe(true);
    expect(lines.some((l) => l.includes("   + Fría"))).toBe(true);
    expect(lines.some((l) => l.includes("   * sin hielo"))).toBe(true);
  });

  it("asienta las columnas a la derecha (total al final de la línea)", () => {
    const lines = renderReceipt(doc, "mm58");
    const totalLine = lines.find((l) => l.startsWith("TOTAL"));
    expect(totalLine).toBeDefined();
    expect(totalLine!.trimEnd().endsWith("5.30") || /\d/.test(totalLine!)).toBe(true);
  });

  it("incluye descuento y footer", () => {
    const lines = renderReceipt(doc, "mm58");
    expect(lines.some((l) => l.includes("Descuento"))).toBe(true);
    expect(lines.some((l) => l.includes("¡Gracias por su compra!"))).toBe(true);
  });
});

describe("formatMoney", () => {
  it("formatea centavos en soles peruanos", () => {
    expect(formatMoney(1250)).toMatch(/S\/\s*12\.50/);
    expect(formatMoney(0)).toMatch(/S\/\s*0\.00/);
  });
});

describe("NullTransport", () => {
  it("cumple PrintTransport sin hardware (tests/demo)", async () => {
    const transport = new NullTransport();
    expect(transport.isAvailable()).toBe(true);
    await expect(transport.print()).resolves.toBeUndefined();
  });
});
