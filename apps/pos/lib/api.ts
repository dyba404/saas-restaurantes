/**
 * Cliente HTTP del POS contra web-admin (:3000). CORS resuelto por el backend.
 * REGLA offline-first: todas las llamadas tienen timeout de 2.5s y la app
 * degrada a demo local si la red falla — nada bloquea el flujo del mesero.
 */
import type { Category, Product } from "@rest/types";
import { categories as demoCategories, products as demoProducts } from "./catalog";
import type { PayableOrder } from "./pos-types";

/**
 * Config inyectada en BUILD (NEXT_PUBLIC_* se inlinean al compilar).
 * En dev cae a localhost; en deploy el Dockerfile pasa los valores reales.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
export const ORG_SLUG = process.env.NEXT_PUBLIC_ORG_SLUG ?? "cevicheria-el-muelle";
export const ORG_HEADERS: Record<string, string> = { "X-Org-Slug": ORG_SLUG };

const BOOTSTRAP_CACHE_KEY = "rest.pos.bootstrap.cache";

/** Header de dispositivo cuando ya se activó esta tablet. */
export function deviceHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("rest.device.token");
    return token ? { "X-Device-Token": token } : {};
  } catch {
    return {};
  }
}

/** Si el API exige token (DEVICE_AUTH=true), lo pide una vez y lo guarda. */
function ensureDeviceToken(): string | null {
  try {
    let token = localStorage.getItem("rest.device.token");
    if (!token) {
      token = window.prompt("Activa esta tablet: pega el token que te dio el administrador") ?? "";
      if (!token) return null;
      localStorage.setItem("rest.device.token", token.trim());
      window.location.reload(); // el motor de sync nació sin token: remonta limpio
    }
    return token.trim();
  } catch {
    return null;
  }
}

/** fetch con AbortController y timeout — jamás cuelga la UI más de timeoutMs. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 2_500,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      headers: { ...init.headers, ...deviceHeaders() },
      signal: controller.signal,
    });
    if (response.status === 403) {
      const body = (await response.clone().json().catch(() => null)) as { code?: string } | null;
      if (body?.code === "device_required") {
        clearTimeout(timer);
        const token = ensureDeviceToken();
        if (token) {
          return fetchJson<T>(url, { ...init, headers: { ...init.headers, "X-Device-Token": token } }, timeoutMs);
        }
        throw new Error("Dispositivo no autorizado");
      }
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ── Bootstrap (catálogo + mesas + contexto) ─────────────────────────────────

export interface BootstrapOrganization {
  name: string;
  slug: string;
  currency: string;
}

export interface BootstrapLocation {
  id: string;
  name: string;
}

export interface BootstrapCategory {
  id: string;
  name: string;
  sortOrder?: number;
}

export interface BootstrapModifier {
  id: string;
  name: string;
  priceCents?: number;
}

export interface BootstrapModifierGroup {
  id: string;
  name: string;
  required?: boolean;
  minSelect?: number;
  maxSelect?: number;
  modifiers: BootstrapModifier[];
}

export interface BootstrapProduct {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  priceCents: number;
  available?: boolean;
  modifierGroups?: BootstrapModifierGroup[];
}

export interface BootstrapTable {
  id: string;
  name: string;
  zone?: string;
  status?: string;
}

export interface BootstrapResponse {
  organization: BootstrapOrganization;
  location: BootstrapLocation;
  categories: BootstrapCategory[];
  products: BootstrapProduct[];
  tables: BootstrapTable[];
}

export interface PosTable {
  id: string;
  name: string;
  zone?: string;
  status?: string;
}

/** Instantánea de catálogo lista para pintar, sea de red, caché o demo. */
export interface CatalogSnapshot {
  organization: BootstrapOrganization;
  location: BootstrapLocation;
  categories: Category[];
  products: Product[];
  tables: PosTable[];
}

/** De dónde salió el catálogo que se muestra (chip de la barra superior). */
export type CatalogSource = "loading" | "live" | "cache" | "demo";

export function mapBootstrap(data: BootstrapResponse): CatalogSnapshot {
  const categories: Category[] = [...data.categories]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder ?? 0, active: true }));
  const products: Product[] = data.products.map((p) => ({
    id: p.id,
    categoryId: p.categoryId,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    active: true,
    available: p.available ?? true,
    modifierGroups: (p.modifierGroups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      required: g.required ?? false,
      minSelect: g.minSelect ?? 0,
      maxSelect: g.maxSelect ?? 1,
      modifiers: g.modifiers.map((m) => ({
        id: m.id,
        name: m.name,
        priceCents: m.priceCents ?? 0,
      })),
    })),
  }));
  return {
    organization: data.organization,
    location: data.location,
    categories,
    products,
    tables: data.tables,
  };
}

const DEMO_ORG: BootstrapOrganization = {
  name: "Cevichería El Muelle",
  slug: ORG_SLUG,
  currency: "PEN",
};
const DEMO_LOCATION: BootstrapLocation = { id: "loc-demo", name: "Sucursal Centro" };

const DEMO_TABLES: PosTable[] = [
  { id: "t1", name: "Mesa 1", zone: "Salón", status: "free" },
  { id: "t2", name: "Mesa 2", zone: "Salón", status: "occupied" },
  { id: "t3", name: "Mesa 3", zone: "Salón", status: "free" },
  { id: "t4", name: "Mesa 4", zone: "Terraza", status: "bill" },
  { id: "t5", name: "Mesa 5", zone: "Terraza", status: "free" },
  { id: "tk", name: "Para llevar", zone: "Mostrador", status: "free" },
];

/** Catálogo demo offline (lib/catalog.ts) con el mismo molde que el bootstrap. */
export function demoCatalog(): CatalogSnapshot {
  return {
    organization: DEMO_ORG,
    location: DEMO_LOCATION,
    categories: demoCategories,
    products: demoProducts,
    tables: DEMO_TABLES,
  };
}

export async function fetchBootstrap(): Promise<BootstrapResponse> {
  const data = await fetchJson<BootstrapResponse>(`${API_BASE}/api/bootstrap`, {
    headers: ORG_HEADERS,
  });
  saveBootstrapCache(data);
  return data;
}

export function saveBootstrapCache(data: BootstrapResponse): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify(data));
  }
}

export function loadBootstrapCache(): BootstrapResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BOOTSTRAP_CACHE_KEY);
    return raw ? (JSON.parse(raw) as BootstrapResponse) : null;
  } catch {
    return null;
  }
}

// ── Órdenes abiertas (GET /api/orders?active=1) ─────────────────────────────

export interface RemoteOrderItem {
  name: string;
  quantity: number;
  notes?: string;
  modifiers?: string[];
  unitPriceCents?: number;
}

export interface RemoteOrder {
  number: number;
  channel: string;
  status: string;
  target: string;
  staffName?: string;
  elapsedMinutes: number;
  createdAt: string;
  items: RemoteOrderItem[];
  /** Opcional: la API mínima no lo trae; el mock y las versiones futuras sí. */
  totalCents?: number;
  subtotalCents?: number;
}

export interface ActiveOrdersResponse {
  orders: RemoteOrder[];
}

export async function fetchActiveOrders(): Promise<ActiveOrdersResponse> {
  return fetchJson<ActiveOrdersResponse>(`${API_BASE}/api/orders?active=1`, {
    headers: ORG_HEADERS,
  });
}

/** Mock local (modo demo) — 3 órdenes abiertas con precios para cobrar. */
export function mockActiveOrders(): RemoteOrder[] {
  const now = Date.now();
  const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
  return [
    {
      number: 507,
      channel: "pos",
      status: "ready",
      target: "Mesa 2",
      staffName: "Ana",
      elapsedMinutes: 14,
      createdAt: minutesAgo(14),
      items: [
        { name: "Tacos de pastor", quantity: 3, modifiers: ["Sin cebolla"], unitPriceCents: 2_500 },
        { name: "Agua de horchata", quantity: 1, unitPriceCents: 1_500 },
      ],
      totalCents: 9_000,
      subtotalCents: 9_000,
    },
    {
      number: 508,
      channel: "whatsapp",
      status: "preparing",
      target: "Para llevar",
      elapsedMinutes: 6,
      createdAt: minutesAgo(6),
      items: [
        { name: "Gringas", quantity: 2, notes: "sin picante", unitPriceCents: 4_500 },
      ],
      totalCents: 9_000,
      subtotalCents: 9_000,
    },
    {
      number: 509,
      channel: "qr",
      status: "served",
      target: "Mesa 5",
      staffName: "Beto",
      elapsedMinutes: 2,
      createdAt: minutesAgo(2),
      items: [
        { name: "Queso fundido", quantity: 1, unitPriceCents: 6_500 },
        { name: "Coca-Cola 600ml", quantity: 2, unitPriceCents: 2_000 },
      ],
      totalCents: 10_500,
      subtotalCents: 10_500,
    },
  ];
}

/** Total de una orden remota: explícito, o suma de items como último recurso. */
export function remoteOrderTotalCents(order: RemoteOrder): number {
  return (
    order.totalCents ??
    order.subtotalCents ??
    order.items.reduce((sum, item) => sum + (item.unitPriceCents ?? 0) * item.quantity, 0)
  );
}

/** Adaptador RemoteOrder → PayableOrder para el flujo de cobro. */
export function remoteOrderToPayable(order: RemoteOrder): PayableOrder {
  const items = order.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents ?? 0,
    modifiers: item.modifiers,
    notes: item.notes,
  }));
  const subtotalCents = remoteOrderTotalCents(order);
  return {
    id: `remote-${order.number}`,
    source: "remote",
    needsCreate: false,
    number: order.number,
    channel: order.channel,
    table: order.target,
    staffName: order.staffName,
    items,
    subtotalCents,
    discountCents: 0,
    totalCents: subtotalCents,
  };
}
