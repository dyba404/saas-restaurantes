/**
 * Canales de venta — estado de integraciones por canal.
 * Mock local con la misma forma que devolvería la API (F1 conectará RappiChef, etc.).
 */

export type ChannelHealth = "connected" | "degraded" | "down";

export interface SalesChannel {
  id: string;
  name: string;
  /** Estado del canal: se muestra con punto, no con bloque de color. */
  health: ChannelHealth;
  healthLabel: string;
  detail: string;
  ordersToday: number;
  /** Comisión % del marketplace o costo fijo mensual (en centavos si es fijo). */
  commissionPct: number | null;
  fixedCostCents: number | null;
  /** Pausado = la tienda sigue conectada pero no recibe órdenes. */
  paused: boolean;
}

export const FALLBACK_CHANNELS: SalesChannel[] = [
  {
    id: "rappi",
    name: "Rappi",
    health: "connected",
    healthLabel: "Conectado",
    detail: "Última sincronización: hace 4 min",
    ordersToday: 18,
    commissionPct: 22,
    fixedCostCents: null,
    paused: false,
  },
  {
    id: "glovo",
    name: "Glovo",
    health: "degraded",
    healthLabel: "Degradado",
    detail: "Menú desactualizado desde ayer",
    ordersToday: 7,
    commissionPct: 25,
    fixedCostCents: null,
    paused: false,
  },
  {
    id: "pedidosya",
    name: "PedidosYa",
    health: "connected",
    healthLabel: "Conectado",
    detail: "Última sincronización: hace 11 min",
    ordersToday: 5,
    commissionPct: 20,
    fixedCostCents: null,
    paused: false,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    health: "connected",
    healthLabel: "Conectado",
    detail: "Número verificado · +51 91234 5678",
    ordersToday: 12,
    commissionPct: 0,
    fixedCostCents: 39_900,
    paused: false,
  },
  {
    id: "qr",
    name: "Carta QR",
    health: "connected",
    healthLabel: "Conectado",
    detail: "12 mesas activas ahora mismo",
    ordersToday: 46,
    commissionPct: 0,
    fixedCostCents: 0,
    paused: false,
  },
  {
    id: "web",
    name: "Tienda web",
    health: "down",
    healthLabel: "Caído",
    detail: "Sin respuesta del checkout desde 14:05",
    ordersToday: 3,
    commissionPct: 0,
    fixedCostCents: 29_900,
    paused: false,
  },
];

/** Punto de color por estado del canal (verde / ámbar / rojo). */
export const healthDot: Record<ChannelHealth, string> = {
  connected: "bg-success",
  degraded: "bg-warning",
  down: "bg-destructive",
};

// ── Feed unificado (preview estático de órdenes entrantes) ──────────────────

export interface FeedOrder {
  id: string;
  channel: string;
  reference: string;
  itemsSummary: string;
  totalCents: number;
  receivedAt: string;
  state: "nueva" | "en cocina" | "lista";
}

export const FEED_ORDERS: FeedOrder[] = [
  {
    id: "f1",
    channel: "WhatsApp",
    reference: "+51 9880 8801",
    itemsSummary: "2 pastor, 1 gringa, 2 refrescos",
    totalCents: 19_500,
    receivedAt: "14:41",
    state: "nueva",
  },
  {
    id: "f2",
    channel: "Rappi",
    reference: "#88230",
    itemsSummary: "1 TIRADITO, 1 chicha morada",
    totalCents: 12_800,
    receivedAt: "14:39",
    state: "en cocina",
  },
  {
    id: "f3",
    channel: "Carta QR",
    reference: "Mesa 7",
    itemsSummary: "4 tacos, guacamole, 2 cervezas",
    totalCents: 24_000,
    receivedAt: "14:36",
    state: "en cocina",
  },
  {
    id: "f4",
    channel: "Glovo",
    reference: "#88229",
    itemsSummary: "3 gringas, flan",
    totalCents: 18_200,
    receivedAt: "14:31",
    state: "lista",
  },
  {
    id: "f5",
    channel: "PedidosYa",
    reference: "#5521",
    itemsSummary: "2 quesadillas, refresco",
    totalCents: 11_300,
    receivedAt: "14:27",
    state: "lista",
  },
];

/** Etiquetas de estado del feed con variante de Badge suave. */
export const feedStateVariant: Record<FeedOrder["state"], "warning" | "info" | "success"> = {
  nueva: "warning",
  "en cocina": "info",
  lista: "success",
};
