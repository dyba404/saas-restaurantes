/**
 * CRM / Loyalty — datos y contratos del módulo Clientes.
 * El fallback tiene la MISMA forma que la respuesta de GET /api/customers,
 * así la UI no distingue entre API real y modo offline.
 */

export const LOYALTY_GOAL = 1_000; // puntos para la recompensa

export interface Customer {
  id: string;
  name: string;
  phone: string;
  loyaltyPoints: number;
  lastVisitAt: string | null;
}

export interface CustomersResponse {
  customers: Customer[];
}

/** Fallback offline-first (misma forma que la API). */
export const FALLBACK_CUSTOMERS: CustomersResponse = {
  customers: [
    { id: "c1", name: "María Fernández", phone: "+51 91234 5678", loyaltyPoints: 860, lastVisitAt: isoDaysAgo(1) },
    { id: "c2", name: "Jorge Ramírez", phone: "+51 98765 4321", loyaltyPoints: 420, lastVisitAt: isoDaysAgo(3) },
    { id: "c3", name: "Lucía Herrera", phone: "+51 92233 4455", loyaltyPoints: 1_240, lastVisitAt: isoDaysAgo(2) },
    { id: "c4", name: "Andrés Peña", phone: "+51 99988 7766", loyaltyPoints: 150, lastVisitAt: isoDaysAgo(6) },
    { id: "c5", name: "Sofía Castillo", phone: "+51 94455 6677", loyaltyPoints: 640, lastVisitAt: isoDaysAgo(12) },
    { id: "c6", name: "Diego Navarro", phone: "+51 93311 2200", loyaltyPoints: 310, lastVisitAt: isoDaysAgo(21) },
    { id: "c7", name: "Valeria Ríos", phone: "+51 96677 8899", loyaltyPoints: 90, lastVisitAt: isoDaysAgo(28) },
    { id: "c8", name: "Emiliano Vidal", phone: "+51 97788 9900", loyaltyPoints: 520, lastVisitAt: isoDaysAgo(47) },
    { id: "c9", name: "Renata Solís", phone: "+51 91122 3344", loyaltyPoints: 780, lastVisitAt: isoDaysAgo(53) },
    { id: "c10", name: "Tomás Aguirre", phone: "+51 95566 7788", loyaltyPoints: 0, lastVisitAt: null },
  ],
};

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(14, 30, 0, 0);
  return d.toISOString();
}

/** Guard defensivo: si la API responde con otra forma, caemos al fallback. */
export function isCustomersResponse(value: unknown): value is CustomersResponse {
  if (typeof value !== "object" || value === null || !Array.isArray((value as CustomersResponse).customers)) {
    return false;
  }
  return (value as CustomersResponse).customers.every(
    (c) =>
      typeof c === "object" &&
      c !== null &&
      typeof c.id === "string" &&
      typeof c.name === "string" &&
      typeof c.phone === "string" &&
      typeof c.loyaltyPoints === "number" &&
      (typeof c.lastVisitAt === "string" || c.lastVisitAt === null),
  );
}

// ── Segmentos (derivados de los campos que expone la API) ───────────────────

export type Segment = "VIP" | "Frecuente" | "Nuevo" | "Inactivo";

export const SEGMENTS: readonly Segment[] = ["VIP", "Frecuente", "Nuevo", "Inactivo"];

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

export function segmentOf(c: Customer): Segment {
  const days = daysSince(c.lastVisitAt);
  if (days === null || days > 45) return "Inactivo";
  if (c.loyaltyPoints >= 800) return "VIP";
  if (c.loyaltyPoints >= 300) return "Frecuente";
  return "Nuevo";
}

/** % de progreso hacia la recompensa (0–100). */
export function progressPct(points: number): number {
  return Math.min(100, Math.round((points / LOYALTY_GOAL) * 100));
}

export function relativeVisit(iso: string | null): string {
  const days = daysSince(iso);
  if (days === null) return "Sin visitas";
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? "Hace 1 mes" : `Hace ${months} meses`;
}

// ── Historial mock del perfil (misma forma que devolvería la API) ───────────

export interface VisitHistoryEntry {
  id: string;
  dateAt: string;
  totalCents: number;
  channel: string;
  itemsSummary: string;
  pointsEarned: number;
}

/** Historial determinístico por cliente (mock F2 hasta tener órdenes reales). */
export function mockVisitHistory(customer: Customer): VisitHistoryEntry[] {
  const seed = customer.id.charCodeAt(customer.id.length - 1) ?? 3;
  const menus = [
    "Ceviche de pescado ×4, chicha morada",
    "Ceviche mixto ×2, cerveza artesanal",
    "TIRADITO ×1, guacamole, refresco",
    "Lomo saltado, tacos de pollo ×3",
  ];
  const channels = ["POS", "Menú QR", "WhatsApp", "Rappi"];
  return Array.from({ length: 4 }, (_, i) => ({
    id: `${customer.id}-v${i + 1}`,
    dateAt: isoDaysAgo(2 + i * 9 + (seed % 5)),
    totalCents: 12_000 + ((seed + i * 37) % 40) * 900,
    channel: channels[(seed + i) % channels.length] as string,
    itemsSummary: menus[(seed + i) % menus.length] as string,
    pointsEarned: 40 + ((seed + i * 13) % 90),
  }));
}

// ── Campañas WhatsApp (mock) ────────────────────────────────────────────────

export interface CampaignTemplate {
  id: string;
  name: string;
  body: string;
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "t1",
    name: "Reactivación",
    body: "¡Te extrañamos, {nombre}! 🌮 Esta semana tus ceviche de pescado tienen 2×1. ¿Vamos hoy?",
  },
  {
    id: "t2",
    name: "Puntos por vencer",
    body: "Hola {nombre}, tienes {puntos} puntos que vencen el 30 de sep. Canjéalos antes de que vuelen.",
  },
  {
    id: "t3",
    name: "Nuevo en el menú",
    body: "{nombre}, ya probaste nuestro TIRADITO de la casa? Pasa esta semana y sumamos puntos dobles.",
  },
];
