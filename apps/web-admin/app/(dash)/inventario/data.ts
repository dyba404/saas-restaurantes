/**
 * Inventario — mock local con la forma que expondría GET /api/inventory (F1).
 * La función estadoStock() es pura y exportada para reutilizarla cuando
 * lleguen datos reales de la DB.
 */

export interface Insumo {
  id: string;
  nombre: string;
  stock: number;
  unidad: string;
  minimo: number;
  /** Costo por unidad en centavos. */
  costoUnitarioCents: number;
}

export type EstadoStock = "ok" | "bajo" | "critico";

/**
 * Regla de estado: crítico a la mitad del mínimo (o en cero), bajo al llegar
 * al mínimo, ok por encima. Pura para conectar DB después sin tocar la UI.
 */
export function estadoStock(stock: number, minimo: number): EstadoStock {
  if (stock <= 0 || stock <= minimo / 2) return "critico";
  if (stock <= minimo) return "bajo";
  return "ok";
}

export const ESTADO_STOCK_META: Record<EstadoStock, { label: string; badge: "success" | "warning" | "danger"; dot: string }> = {
  ok: { label: "OK", badge: "success", dot: "bg-success" },
  bajo: { label: "Bajo", badge: "warning", dot: "bg-warning" },
  critico: { label: "Crítico", badge: "danger", dot: "bg-destructive" },
};

export interface Compra {
  id: string;
  insumo: string;
  cantidad: number;
  unidad: string;
  totalCents: number;
  fecha: string;
}

export const ULTIMAS_COMPRAS: Compra[] = [
  { id: "c1", insumo: "Carne de pastor", cantidad: 10, unidad: "kg", totalCents: 140_000, fecha: "10 sep" },
  { id: "c2", insumo: "Tortillas", cantidad: 500, unidad: "piezas", totalCents: 12_500, fecha: "9 sep" },
  { id: "c3", insumo: "Vasos 600 ml", cantidad: 1_000, unidad: "piezas", totalCents: 120_000, fecha: "7 sep" },
];

export interface Ajuste {
  id: string;
  insumo: string;
  antes: number;
  despues: number;
  unidad: string;
  motivo: string;
  cuando: string;
}

export const AJUSTES_INICIALES: Ajuste[] = [
  { id: "a1", insumo: "Queso oaxaca", antes: 2.5, despues: 1.8, unidad: "kg", motivo: "Conteo físico", cuando: "Hoy · 09:12" },
  { id: "a2", insumo: "Aguacate", antes: 30, despues: 28, unidad: "piezas", motivo: "Merma", cuando: "Ayer · 21:40" },
];

export const INSUMOS: Insumo[] = [
  { id: "i1", nombre: "Tortillas", stock: 95, unidad: "piezas", minimo: 100, costoUnitarioCents: 25 },
  { id: "i2", nombre: "Carne de pastor", stock: 6.5, unidad: "kg", minimo: 8, costoUnitarioCents: 14_000 },
  { id: "i3", nombre: "Queso oaxaca", stock: 1.8, unidad: "kg", minimo: 4, costoUnitarioCents: 9_600 },
  { id: "i4", nombre: "Causa limeña", stock: 4.2, unidad: "kg", minimo: 3, costoUnitarioCents: 5_200 },
  { id: "i5", nombre: "Aguacate", stock: 28, unidad: "piezas", minimo: 15, costoUnitarioCents: 800 },
  { id: "i6", nombre: "Limones", stock: 2.4, unidad: "kg", minimo: 1.5, costoUnitarioCents: 2_800 },
  { id: "i7", nombre: "Vasos 600 ml", stock: 350, unidad: "piezas", minimo: 200, costoUnitarioCents: 120 },
  { id: "i8", nombre: "Cajas para llevar", stock: 40, unidad: "piezas", minimo: 80, costoUnitarioCents: 250 },
];

/** Formato de cantidad: quita decimales si es entero (6.5 kg → "6.5", 95 → "95"). */
export function fmtCantidad(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("es-PE", { maximumFractionDigits: 2 });
}
