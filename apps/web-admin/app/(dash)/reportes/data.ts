/**
 * Reportes — datos mock por rango (Hoy / 7 días / Mes) con la misma forma
 * que devolvería GET /api/reports?range=… e utilidades para exportar CSV real.
 */

export type ReportRange = "hoy" | "7d" | "mes";

export const RANGES: readonly { id: ReportRange; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "7d", label: "7 días" },
  { id: "mes", label: "Mes" },
];

export interface SeriesPoint {
  label: string;
  cents: number;
}

export interface ChannelSlice {
  name: string;
  /** % de las ventas del periodo. */
  pct: number;
  cents: number;
  /** Comisión del marketplace (0 = canal propio). */
  commissionPct: number;
}

export interface EmployeeRow {
  name: string;
  salesCents: number;
  tickets: number;
}

export interface ProductRow {
  name: string;
  count: number;
  revenueCents: number;
}

export interface ReservationsSnapshot {
  booked: number;
  seated: number;
  noShows: number;
}

export interface RangeReport {
  label: string;
  /** "Ventas por hora" o "Ventas por día" según el rango. */
  seriesLabel: string;
  series: SeriesPoint[];
  byChannel: ChannelSlice[];
  byEmployee: EmployeeRow[];
  topProducts: ProductRow[];
  reservations: ReservationsSnapshot;
  tickets: number;
  salesCents: number;
  avgTicketCents: number;
}

/** Escala monocroma del acento — la identidad la da la etiqueta, no el color. */
export const BAR_SHADES = ["bg-primary", "bg-primary/70", "bg-primary/45", "bg-primary/25"] as const;

export function barShade(rank: number): string {
  return BAR_SHADES[Math.min(rank, BAR_SHADES.length - 1)];
}

function makeReport(
  base: Omit<RangeReport, "salesCents" | "avgTicketCents">,
): RangeReport {
  const salesCents = base.series.reduce((acc, p) => acc + p.cents, 0);
  return {
    ...base,
    salesCents,
    avgTicketCents: base.tickets > 0 ? Math.round(salesCents / base.tickets) : 0,
  };
}

/** Serie del mes: onda semanal determinística (fines de semana más altos). */
function monthSeries(): SeriesPoint[] {
  return Array.from({ length: 30 }, (_, i) => {
    const weekend = i % 7 === 5 || i % 7 === 6 ? 1.45 : 1;
    const cents = Math.round((3_600_000 + ((i * 37) % 11) * 95_000) * weekend);
    return { label: String(i + 1), cents };
  });
}

export const REPORTS: Record<ReportRange, RangeReport> = {
  hoy: makeReport({
    label: "Hoy",
    seriesLabel: "Ventas por hora",
    series: [
      { label: "11:00", cents: 180_000 },
      { label: "12:00", cents: 420_000 },
      { label: "13:00", cents: 780_000 },
      { label: "14:00", cents: 960_000 },
      { label: "15:00", cents: 690_000 },
      { label: "16:00", cents: 410_000 },
      { label: "17:00", cents: 220_000 },
      { label: "18:00", cents: 310_000 },
      { label: "19:00", cents: 480_000 },
      { label: "20:00", cents: 560_000 },
    ],
    byChannel: [
      { name: "POS", pct: 62, cents: 3_106_000, commissionPct: 0 },
      { name: "Menú QR", pct: 18, cents: 902_000, commissionPct: 0 },
      { name: "WhatsApp", pct: 14, cents: 701_000, commissionPct: 0 },
      { name: "Rappi", pct: 6, cents: 301_000, commissionPct: 22 },
    ],
    byEmployee: [
      { name: "Luis García", salesCents: 1_950_000, tickets: 51 },
      { name: "Ana Torres", salesCents: 1_720_000, tickets: 47 },
      { name: "Marisol Vega", salesCents: 890_000, tickets: 22 },
      { name: "Diego Luna", salesCents: 450_000, tickets: 12 },
    ],
    topProducts: [
      { name: "Ceviche de pescado", count: 214, revenueCents: 810_000 },
      { name: "Ceviche mixto", count: 71, revenueCents: 320_000 },
      { name: "Cerveza artesanal", count: 98, revenueCents: 294_000 },
      { name: "TIRADITO", count: 39, revenueCents: 195_000 },
      { name: "Chicha morada", count: 64, revenueCents: 96_000 },
    ],
    reservations: { booked: 8, seated: 2, noShows: 1 },
    tickets: 132,
  }),
  "7d": makeReport({
    label: "Últimos 7 días",
    seriesLabel: "Ventas por día",
    series: [
      { label: "Lun", cents: 3_100_000 },
      { label: "Mar", cents: 3_450_000 },
      { label: "Mié", cents: 3_900_000 },
      { label: "Jue", cents: 4_100_000 },
      { label: "Vie", cents: 5_010_000 },
      { label: "Sáb", cents: 5_800_000 },
      { label: "Dom", cents: 4_900_000 },
    ],
    byChannel: [
      { name: "POS", pct: 58, cents: 17_550_800, commissionPct: 0 },
      { name: "Menú QR", pct: 20, cents: 6_052_000, commissionPct: 0 },
      { name: "WhatsApp", pct: 13, cents: 3_933_800, commissionPct: 0 },
      { name: "Rappi", pct: 6, cents: 1_815_600, commissionPct: 22 },
      { name: "PedidosYa", pct: 3, cents: 907_800, commissionPct: 20 },
    ],
    byEmployee: [
      { name: "Luis García", salesCents: 11_400_000, tickets: 290 },
      { name: "Ana Torres", salesCents: 10_300_000, tickets: 265 },
      { name: "Marisol Vega", salesCents: 5_600_000, tickets: 140 },
      { name: "Diego Luna", salesCents: 2_960_000, tickets: 80 },
    ],
    topProducts: [
      { name: "Ceviche de pescado", count: 1_380, revenueCents: 5_200_000 },
      { name: "Ceviche mixto", count: 430, revenueCents: 1_940_000 },
      { name: "Cerveza artesanal", count: 610, revenueCents: 1_850_000 },
      { name: "TIRADITO", count: 250, revenueCents: 1_250_000 },
      { name: "Chicha morada", count: 405, revenueCents: 610_000 },
    ],
    reservations: { booked: 54, seated: 44, noShows: 6 },
    tickets: 775,
  }),
  mes: makeReport({
    label: "Últimos 30 días",
    seriesLabel: "Ventas por día",
    series: monthSeries(),
    byChannel: [
      { name: "POS", pct: 57, cents: 68_628_000, commissionPct: 0 },
      { name: "Menú QR", pct: 21, cents: 25_284_000, commissionPct: 0 },
      { name: "WhatsApp", pct: 13, cents: 15_652_000, commissionPct: 0 },
      { name: "Rappi", pct: 6, cents: 7_224_000, commissionPct: 22 },
      { name: "PedidosYa", pct: 3, cents: 3_612_000, commissionPct: 20 },
    ],
    byEmployee: [
      { name: "Luis García", salesCents: 44_800_000, tickets: 1_180 },
      { name: "Ana Torres", salesCents: 40_900_000, tickets: 1_060 },
      { name: "Marisol Vega", salesCents: 22_600_000, tickets: 570 },
      { name: "Diego Luna", salesCents: 12_100_000, tickets: 330 },
    ],
    topProducts: [
      { name: "Ceviche de pescado", count: 5_900, revenueCents: 22_300_000 },
      { name: "Ceviche mixto", count: 1_840, revenueCents: 8_300_000 },
      { name: "Cerveza artesanal", count: 2_650, revenueCents: 8_000_000 },
      { name: "TIRADITO", count: 1_090, revenueCents: 5_450_000 },
      { name: "Chicha morada", count: 1_760, revenueCents: 2_650_000 },
    ],
    reservations: { booked: 232, seated: 196, noShows: 24 },
    tickets: 3_140,
  }),
};

// ── Export CSV (descarga real con Blob) ─────────────────────────────────────

type CsvCell = string | number;

function csvEscape(value: CsvCell): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

/** PEN plano con decimales — para hojas de cálculo, no para la UI. */
const mxn = (cents: number): number => Math.round(cents) / 100;

/** CSV completo de los datos visibles en pantalla. */
export function buildCsv(report: RangeReport): string {
  const rows: CsvCell[][] = [
    ["Reporte de ventas — Cevichería El Muelle · Centro"],
    ["Rango", report.label],
    ["Ventas totales (PEN)", mxn(report.salesCents)],
    ["Tickets", report.tickets],
    ["Ticket promedio (PEN)", mxn(report.avgTicketCents)],
    [],
    [report.seriesLabel],
    ["Periodo", "Ventas PEN"],
    ...report.series.map((p) => [p.label, mxn(p.cents)] as CsvCell[]),
    [],
    ["Ventas por canal"],
    ["Canal", "% de ventas", "Ventas PEN"],
    ...report.byChannel.map((c) => [c.name, c.pct, mxn(c.cents)] as CsvCell[]),
    [],
    ["Ventas por empleado"],
    ["Empleado", "Ventas PEN", "Tickets"],
    ...report.byEmployee.map((e) => [e.name, mxn(e.salesCents), e.tickets] as CsvCell[]),
    [],
    ["Top productos"],
    ["Producto", "Cantidad", "Ingresos PEN"],
    ...report.topProducts.map((p) => [p.name, p.count, mxn(p.revenueCents)] as CsvCell[]),
    [],
    ["Reservas vs no-shows"],
    ["Reservadas", "Sentadas", "No-shows"],
    [report.reservations.booked, report.reservations.seated, report.reservations.noShows],
  ];
  return toCsv(rows);
}

/** Versión resumida para el contador: ingresos por canal, comisión y neto. */
export function buildAccountantCsv(report: RangeReport): string {
  const commission = (c: ChannelSlice): number => Math.round((c.cents * c.commissionPct) / 100);
  const totalCommission = report.byChannel.reduce((acc, c) => acc + commission(c), 0);
  const rows: CsvCell[][] = [
    ["Reporte para contador — Cevichería El Muelle · Centro"],
    ["Rango", report.label],
    ["Generado", new Date().toISOString().slice(0, 10)],
    [],
    ["Canal", "Ventas PEN", "Comisión %", "Comisión PEN", "Venta neta PEN"],
    ...report.byChannel.map(
      (c) =>
        [c.name, mxn(c.cents), c.commissionPct, mxn(commission(c)), mxn(c.cents - commission(c))] as CsvCell[],
    ),
    [
      "Total",
      mxn(report.salesCents),
      "",
      mxn(totalCommission),
      mxn(report.salesCents - totalCommission),
    ],
    [],
    ["Tickets", report.tickets],
    ["Ticket promedio (PEN)", mxn(report.avgTicketCents)],
    ["Notas: cifras en PEN. Desglose de IVA pendiente para F2 (facturación)."],
  ];
  return toCsv(rows);
}

/** Dispara la descarga del CSV en el navegador. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
