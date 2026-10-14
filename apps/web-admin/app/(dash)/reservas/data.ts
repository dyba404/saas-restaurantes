/**
 * Reservas — contratos y fallback con la MISMA forma que devolvería
 * GET /api/reservations, para que la UI no distinga entre mock y API.
 */

export type ReservationStatus = "confirmada" | "pendiente" | "sentada" | "no-show" | "cancelada";

export interface Reservation {
  id: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  /** ISO datetime — la UI muestra la hora local (HH:MM). */
  startsAt: string;
  status: ReservationStatus;
  notes?: string;
  tableName?: string;
}

export interface ReservationsResponse {
  reservations: Reservation[];
}

function isoAtToday(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** 8 reservas hoy · 42 cubiertos (sin contar canceladas) · 1 no-show. */
export const FALLBACK_RESERVATIONS: ReservationsResponse = {
  reservations: [
    { id: "r1", customerName: "Familia Ortiz", customerPhone: "+51 91010 1010", partySize: 8, startsAt: isoAtToday(13, 0), status: "sentada", tableName: "M3", notes: "Cumpleaños de la abuela" },
    { id: "r2", customerName: "Ana Beltrán", customerPhone: "+51 92020 2020", partySize: 6, startsAt: isoAtToday(13, 30), status: "confirmada", tableName: "M7" },
    { id: "r3", customerName: "Carlos Medina", customerPhone: "+51 93030 3030", partySize: 5, startsAt: isoAtToday(14, 0), status: "confirmada", tableName: "M6" },
    { id: "r4", customerName: "Lucía Herrera", customerPhone: "+51 94040 4040", partySize: 4, startsAt: isoAtToday(14, 30), status: "no-show" },
    { id: "r5", customerName: "Jorge Ramírez", customerPhone: "+51 95050 5050", partySize: 7, startsAt: isoAtToday(15, 0), status: "confirmada", tableName: "Terraza 2", notes: "Traen carrito de bebé" },
    { id: "r6", customerName: "Renata Solís", customerPhone: "+51 96060 6060", partySize: 6, startsAt: isoAtToday(16, 30), status: "pendiente" },
    { id: "r7", customerName: "Familia Vidal", customerPhone: "+51 97070 7070", partySize: 6, startsAt: isoAtToday(19, 0), status: "pendiente" },
    { id: "r8", customerName: "Diego Navarro", customerPhone: "+51 98080 8080", partySize: 3, startsAt: isoAtToday(20, 30), status: "cancelada" },
  ],
};

/** Guard defensivo: si la API responde con otra forma, caemos al fallback. */
export function isReservationsResponse(value: unknown): value is ReservationsResponse {
  if (typeof value !== "object" || value === null || !Array.isArray((value as ReservationsResponse).reservations)) {
    return false;
  }
  return (value as ReservationsResponse).reservations.every(
    (r) =>
      typeof r === "object" &&
      r !== null &&
      typeof r.id === "string" &&
      typeof r.customerName === "string" &&
      typeof r.customerPhone === "string" &&
      typeof r.partySize === "number" &&
      typeof r.startsAt === "string",
  );
}

/** HH:MM legible y determinista desde el ISO de la API. */
export function timeLabel(startsAt: string): string {
  return startsAt.slice(11, 16);
}

/** Variante de Badge suave por estado de la reserva. */
export const reservationVariant: Record<ReservationStatus, "success" | "warning" | "info" | "danger" | "outline"> = {
  confirmada: "success",
  pendiente: "warning",
  sentada: "info",
  "no-show": "danger",
  cancelada: "outline",
};

// ── Waitlist (mock local, la API llega en F3) ───────────────────────────────

export interface WaitlistEntry {
  id: string;
  name: string;
  partySize: number;
  waitingSince: string;
  phone: string;
}

export const WAITLIST: WaitlistEntry[] = [
  { id: "wl1", name: "Los hermanos Cruz", partySize: 4, waitingSince: "14:05", phone: "+51 99090 1010" },
  { id: "wl2", name: "Berenice Ávila", partySize: 2, waitingSince: "14:18", phone: "+51 99090 2020" },
  { id: "wl3", name: "Sergio Ortega", partySize: 3, waitingSince: "14:33", phone: "+51 99090 3030" },
];

/** URL de la página pública de reservas (app del comensal). */
export const PUBLIC_RESERVATIONS_URL = "http://localhost:3003/reservas";
