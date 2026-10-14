"use client";

import { AlertTriangle, Bell, BellOff, Cloud } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, cn } from "@rest/ui";
import { HelpButton } from "@/components/help-modal";
import type { KdsStatus, OrderChannel } from "@rest/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const ORG_SLUG = process.env.NEXT_PUBLIC_ORG_SLUG ?? "cevicheria-el-muelle";
/** Respaldo mientras el push SSE no está abierto (15 s). */
const FALLBACK_POLL_MS = 15_000;
const FETCH_TIMEOUT_MS = 2_500;
const SLA_MINUTES = 10;

/** Token de dispositivo provisionado (DEVICE_AUTH=true en el API). */
function deviceToken(): string | null {
  try {
    return localStorage.getItem("rest.device.token");
  } catch {
    return null;
  }
}

function deviceHeaders(): Record<string, string> {
  const token = deviceToken();
  return token ? { "X-Device-Token": token } : {};
}

// ── Modelo local ────────────────────────────────────────────────────────────

interface KdsItem {
  qty: number;
  name: string;
  note?: string;
}

interface KdsOrder {
  /** Clave estable para diff y para el detector de "orden nueva" (bip). */
  key: string;
  number: string;
  /** Folio para POST /api/orders/status; null en las órdenes mock (avance local). */
  apiNumber: number | null;
  channel: OrderChannel;
  target: string;
  elapsed: string;
  minutes: number;
  items: KdsItem[];
  status: KdsStatus;
}

const INITIAL: KdsOrder[] = [
  {
    key: "#0512",
    number: "#0512",
    apiNumber: null,
    channel: "pos",
    target: "Mesa 4 · Ana",
    elapsed: "3:24",
    minutes: 3,
    status: "new",
    items: [
      { qty: 2, name: "Ceviche de pescado", note: "sin cebolla" },
      { qty: 1, name: "Tiradito" },
      { qty: 2, name: "Chicha morada" },
    ],
  },
  {
    key: "#0515",
    number: "#0515",
    apiNumber: null,
    channel: "whatsapp",
    target: "+51 987…",
    elapsed: "0:48",
    minutes: 1,
    status: "new",
    items: [{ qty: 1, name: "Lomo saltado", note: "sin ají" }],
  },
  {
    key: "#0510",
    number: "#0510",
    apiNumber: null,
    channel: "takeaway",
    target: "Para llevar",
    elapsed: "12:40",
    minutes: 12,
    status: "preparing",
    items: [
      { qty: 2, name: "Ceviche mixto" },
      { qty: 1, name: "Chicharrón de pescado", note: "⚠️ sin gluten" },
    ],
  },
  {
    key: "#0514",
    number: "#0514",
    apiNumber: null,
    channel: "qr",
    target: "Mesa 7",
    elapsed: "11:02",
    minutes: 11,
    status: "preparing",
    items: [{ qty: 1, name: "Arroz con mariscos" }, { qty: 2, name: "Inca Kola" }],
  },
  {
    key: "#0511",
    number: "#0511",
    apiNumber: null,
    channel: "glovo",
    target: "#88230",
    elapsed: "6:15",
    minutes: 6,
    status: "preparing",
    items: [{ qty: 1, name: "Picarones" }, { qty: 3, name: "Ceviche de camarones" }],
  },
  {
    key: "#0508",
    number: "#0508",
    apiNumber: null,
    channel: "pos",
    target: "Mesa 1 · Luis",
    elapsed: "9:30",
    minutes: 9,
    status: "ready",
    items: [{ qty: 2, name: "Ají de gallina" }, { qty: 1, name: "Ensalada" }],
  },
];

const COLUMNS: Array<{
  status: KdsStatus;
  title: string;
  action: string;
  next: "preparing" | "ready" | "served" | null;
}> = [
  { status: "new", title: "Nuevas", action: "COCINAR", next: "preparing" },
  { status: "preparing", title: "Preparando", action: "LISTA", next: "ready" },
  { status: "ready", title: "Listas", action: "SERVIDA", next: "served" },
  { status: "served", title: "Servidas", action: "", next: null },
];

const channelBadge: Record<
  OrderChannel,
  { label: string; variant: "default" | "secondary" | "success" | "info" | "warning" }
> = {
  pos: { label: "POS", variant: "default" },
  qr: { label: "QR", variant: "info" },
  whatsapp: { label: "WhatsApp", variant: "success" },
  takeaway: { label: "Llevar", variant: "secondary" },
  rappi: { label: "Rappi", variant: "warning" },
  glovo: { label: "Glovo", variant: "warning" },
  pedidosya: { label: "PedidosYa", variant: "warning" },
  ubereats: { label: "Uber Eats", variant: "warning" },
};

// ── Mapeo API → KDS ─────────────────────────────────────────────────────────

interface ApiOrderItem {
  name: string;
  quantity: number;
  notes?: string;
  modifiers?: string[];
}

interface ApiOrder {
  number: number | string;
  channel: OrderChannel;
  status: string;
  target: string;
  staffName?: string | null;
  elapsedMinutes: number;
  items?: ApiOrderItem[];
}

/** Rango para comparar "quién va más adelante" (mock "new" y server "sent" empatan). */
const STATUS_RANK: Record<string, number> = { new: 0, sent: 0, preparing: 1, ready: 2, served: 3 };

function formatFolio(n: number): string {
  return `#${String(n).padStart(4, "0")}`;
}

function toKdsOrder(api: ApiOrder): KdsOrder | null {
  const status: KdsStatus | null =
    api.status === "sent" ? "new" : api.status === "preparing" ? "preparing" : api.status === "ready" ? "ready" : null;
  if (!status) return null;

  const raw = typeof api.number === "number" ? api.number : Number.parseInt(String(api.number), 10);
  const hasFolio = Number.isFinite(raw);

  const items: KdsItem[] = (api.items ?? []).map((item) => ({
    qty: item.quantity,
    name: item.name,
    note:
      [item.notes, item.modifiers && item.modifiers.length > 0 ? `con: ${item.modifiers.join(", ")}` : ""]
        .filter(Boolean)
        .join(" · ") || undefined,
  }));

  const minutes = Math.max(0, Math.floor(api.elapsedMinutes ?? 0));
  return {
    key: hasFolio ? String(raw) : String(api.number),
    number: hasFolio ? formatFolio(raw) : String(api.number),
    apiNumber: hasFolio ? raw : null,
    channel: api.channel,
    target: api.staffName ? `${api.target} · ${api.staffName}` : api.target,
    elapsed: `${minutes} min`,
    minutes,
    items,
    status,
  };
}

// ── Avances locales offline-tolerantes ──────────────────────────────────────

/**
 * Si hay un avance local pendiente para una orden, se mantiene en la columna
 * elegida aunque el servidor aún no lo refleje (POST en vuelo o fallido).
 */
function withMoves(orders: KdsOrder[], moves: Map<string, KdsStatus>): KdsOrder[] {
  if (moves.size === 0) return orders;
  return orders.map((o) => {
    const move = moves.get(o.key);
    if (move == null) return o;
    return (STATUS_RANK[move] ?? 0) > (STATUS_RANK[o.status] ?? 0) ? { ...o, status: move } : o;
  });
}

/** Descarta avances locales que el servidor ya alcanzó (o superó). */
function reconcileMoves(moves: Map<string, KdsStatus>, orders: KdsOrder[]): void {
  for (const o of orders) {
    const move = moves.get(o.key);
    if (move != null && (STATUS_RANK[move] ?? 0) <= (STATUS_RANK[o.status] ?? 0)) {
      moves.delete(o.key);
    }
  }
}

/** Compara tableros para evitar setState (y re-render) sin cambios reales. */
function sameBoard(a: KdsOrder[], b: KdsOrder[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((o, i) => o.key === b[i]!.key && o.status === b[i]!.status && o.minutes === b[i]!.minutes);
}

async function postStatus(apiNumber: number, status: "preparing" | "ready" | "served"): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/orders/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Org-Slug": ORG_SLUG, ...deviceHeaders() },
      body: JSON.stringify({ number: apiNumber, status }),
    });
  } catch {
    // Offline-tolerante: la tarjeta ya avanzó en UI; el server la alcanzará al reconectar.
  }
}

export default function KdsPage() {
  const [orders, setOrders] = useState<KdsOrder[]>(INITIAL);
  const [source, setSource] = useState<"live" | "demo">("demo");
  const [sound, setSound] = useState(true);
  const [servedCount, setServedCount] = useState(24);
  /** true cuando el stream SSE está abierto (sin polling de respaldo). */
  const [pushOk, setPushOk] = useState(false);
  /** Reloj real de cocina (HH:mm:ss) — hidratación segura: vacío en el SSR. */
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);

  const movesRef = useRef(new Map<string, KdsStatus>());
  const keysRef = useRef(new Set<string>());
  const soundRef = useRef(sound);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  /** Bip corto con WebAudio (OscillatorNode) — nunca lanza ni rompe el render. */
  const beep = useCallback(() => {
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch {
      // El sonido jamás debe romper la pantalla de cocina.
    }
  }, []);

  function applyLive(live: KdsOrder[]): void {
    reconcileMoves(movesRef.current, live);
    const merged = withMoves(live, movesRef.current);

    const prevKeys = keysRef.current;
    const hasNew = prevKeys.size > 0 && live.some((o) => !prevKeys.has(o.key));
    keysRef.current = new Set(live.map((o) => o.key));
    if (hasNew && soundRef.current) beep();

    setOrders((prev) => (sameBoard(prev, merged) ? prev : merged));
  }

  // ── Refresco en vivo: push SSE + fallback de polling ──────────────────────
  // GET /api/realtime (web-admin) publica "orders.changed" por organización;
  // el KDS refresca al instante. Si el stream cae, EventSource reintenta solo
  // y un polling lento de respaldo cubre el hueco hasta que vuelva a abrir.

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}/api/orders?active=1`, {
        headers: { "X-Org-Slug": ORG_SLUG, ...deviceHeaders() },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { orders?: ApiOrder[] };
      const live = (data.orders ?? [])
        .map(toKdsOrder)
        .filter((o): o is KdsOrder => o !== null);
      applyLive(live);
      setSource("live");
    } catch {
      // Red caída / timeout: mock inicial con los avances locales ya aplicados.
      setSource("demo");
      const demo = withMoves(INITIAL, movesRef.current);
      setOrders((prev) => (sameBoard(prev, demo) ? prev : demo));
    } finally {
      clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyLive solo usa refs y setters estables
  }, [beep]);

  // Primer refresco + refetch al reconectar la red.
  useEffect(() => {
    void refresh();
    const onOnline = () => void refresh();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refresh]);

  // Push SSE: un "orders.changed" dispara un refetch inmediato.
  useEffect(() => {
    const token = deviceToken();
    const url = `${API_BASE}/api/realtime?org=${encodeURIComponent(ORG_SLUG)}${
      token ? `&device=${encodeURIComponent(token)}` : ""
    }`;
    const es = new EventSource(url);
    es.addEventListener("orders.changed", () => {
      void refresh();
    });
    es.onopen = () => setPushOk(true);
    es.onerror = () => setPushOk(false);
    return () => es.close();
  }, [refresh]);

  // Respaldo: solo mientras el push no esté abierto.
  useEffect(() => {
    if (pushOk) return;
    const interval = setInterval(() => void refresh(), FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [pushOk, refresh]);

  function advance(order: KdsOrder): void {
    const col = COLUMNS.find((c) => c.status === order.status);
    if (!col?.next) return;
    const next = col.next;

    // Optimista: la tarjeta se mueve YA; el POST es fire-and-forget.
    setOrders((prev) => prev.map((o) => (o.key === order.key ? { ...o, status: next } : o)));
    movesRef.current.set(order.key, next);
    if (next === "served") setServedCount((n) => n + 1);
    if (order.apiNumber != null) {
      void postStatus(order.apiNumber, next);
    }
  }

  return (
    <div className="flex h-dvh flex-col p-3">
      {/* Barra superior */}
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-lg font-bold tracking-tight">KDS · Cocina principal</h1>
        {source === "live" ? (
          <Badge variant="success">
            <span className="size-2 rounded-full bg-success" aria-hidden />
            en vivo
          </Badge>
        ) : (
          <Badge variant="warning">
            <span className="size-2 rounded-full bg-warning" aria-hidden />
            demo offline
          </Badge>
        )}
        <Badge variant={pushOk ? "success" : "warning"}>
          <Cloud className="size-3" /> {pushOk ? "push en vivo" : "reconectando…"}
        </Badge>
        <span className="ml-auto text-2xl font-bold tabular-nums">{clock || "--:--:--"}</span>
        <button
          type="button"
          onClick={() => setSound((s) => !s)}
          className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />}
          sonido {sound ? "ON" : "OFF"}
        </button>
        <HelpButton />
      </header>

      {/* Móvil (emergencia): columnas con swipe horizontal. Tablet/desktop: grid 4. */}
      <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto md:grid md:grid-cols-4 md:overflow-x-visible">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => o.status === col.status);
          return (
            <section
              key={col.status}
              className="flex min-h-0 w-[78vw] shrink-0 snap-start flex-col rounded-xl border bg-card sm:w-[46vw] md:w-auto md:shrink"
            >
              <h2 className="flex items-center justify-between border-b px-3 py-2 text-base font-bold">
                {col.title}
                <span className="rounded-full bg-muted px-2 text-sm tabular-nums">
                  {col.status === "served" ? servedCount : list.length}
                </span>
              </h2>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                {col.status === "served" && (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    Historial del día (toque largo para recuperar)
                  </p>
                )}
                {list.map((order) => {
                  const late = order.minutes >= SLA_MINUTES && col.status !== "served";
                  const badge = channelBadge[order.channel] ?? {
                    label: order.channel,
                    variant: "secondary" as const,
                  };
                  return (
                    <article
                      key={order.key}
                      className={cn(
                        "rounded-lg border-2 p-3",
                        late ? "border-destructive bg-destructive/10" : "border-border bg-background",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-2xl font-bold tabular-nums">{order.number}</span>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{order.target}</p>
                      <p
                        className={cn(
                          "mt-1 flex items-center gap-1 text-lg font-bold tabular-nums",
                          late && "text-danger-text",
                        )}
                      >
                        {late && <AlertTriangle className="size-5" />}
                        ⏱ {order.elapsed}
                      </p>
                      <ul className="mt-2 space-y-1 border-t pt-2 text-base">
                        {order.items.map((item, i) => (
                          <li key={i}>
                            <span className="font-bold">{item.qty}×</span> {item.name}
                            {item.note && (
                              <span className="block pl-6 text-sm font-medium text-warning-text">
                                {item.note}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {col.action && (
                        <button
                          type="button"
                          onClick={() => advance(order)}
                          className={cn(
                            "mt-3 h-14 w-full rounded-lg text-base font-bold transition-colors",
                            late
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-primary text-primary-foreground hover:bg-primary/90",
                          )}
                        >
                          {col.action}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
