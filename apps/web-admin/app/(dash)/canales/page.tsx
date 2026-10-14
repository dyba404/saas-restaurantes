"use client";

import { Bike, ChevronDown, ChevronUp, FlaskConical, Info, MessageCircle, Pause, Play, RefreshCw, UtensilsCrossed, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, CardContent, cn } from "@rest/ui";
import { ORG_SLUG } from "@/lib/use-api";
import { money } from "@/lib/format";
import { FALLBACK_CHANNELS, healthDot, type SalesChannel } from "./data";

// ── Contrato del API real ───────────────────────────────────────────────────
// GET  /api/orders?active=1          → { orders: [...] }
// POST /api/aggregators/webhook      → { ok, orderNumber, autoAccepted }

interface FeedApiItem {
  name: string;
  quantity: number;
  notes?: string;
  modifiers?: string[];
}

interface FeedApiOrder {
  number: number | null;
  channel: string;
  channelLabel: string;
  status: string;
  target: string;
  elapsedMinutes: number;
  createdAt: string;
  items: FeedApiItem[];
  totalCents: number;
}

interface AggregatorResponse {
  ok?: boolean;
  orderNumber?: number;
  error?: string;
}

const ORG_HEADERS = { "X-Org-Slug": ORG_SLUG } as const;

/** Canales que alimentan el feed unificado (POS se ve en su módulo). */
const FEED_CHANNEL_IDS = new Set(["rappi", "glovo", "pedidosya", "ubereats", "whatsapp", "qr"]);

/** Plataformas con webhook real — únicas que admiten el simulador de pedido. */
const AGGREGATORS = new Set(["rappi", "glovo", "pedidosya", "ubereats"]);

const POLL_MS = 10_000;

// ── Cards de canales (salud simulada) — la API añade Uber Eats al mock F0 ───

const UBEREATS_CHANNEL: SalesChannel = {
  id: "ubereats",
  name: "Uber Eats",
  health: "connected",
  healthLabel: "Conectado",
  detail: "Última sincronización: hace 7 min",
  ordersToday: 9,
  commissionPct: 30,
  fixedCostCents: null,
  paused: false,
};

const CHANNELS: SalesChannel[] = [
  ...FALLBACK_CHANNELS.filter((c) => c.id === "rappi" || c.id === "glovo" || c.id === "pedidosya"),
  UBEREATS_CHANNEL,
  ...FALLBACK_CHANNELS.filter((c) => c.id === "whatsapp" || c.id === "qr"),
];

// ── Mock del feed (fallback offline) — misma forma que GET /api/orders ──────

const minutesAgo = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const MOCK_FEED: FeedApiOrder[] = [
  {
    number: 515, channel: "whatsapp", channelLabel: "WhatsApp", status: "sent", target: "+51 98080 2020",
    elapsedMinutes: 2, createdAt: minutesAgo(2),
    items: [{ name: "Ceviche de pescado", quantity: 2 }, { name: "Chicha morada", quantity: 1 }],
    totalCents: 6_500,
  },
  {
    number: 514, channel: "rappi", channelLabel: "Rappi", status: "preparing", target: "#88231",
    elapsedMinutes: 6, createdAt: minutesAgo(6),
    items: [{ name: "Ceviche de pescado", quantity: 2 }],
    totalCents: 5_000,
  },
  {
    number: 513, channel: "qr", channelLabel: "Menú QR", status: "ready", target: "Mesa 7",
    elapsedMinutes: 11, createdAt: minutesAgo(11),
    items: [{ name: "Ceviche mixto", quantity: 2 }, { name: "Causa limeña", quantity: 1 }],
    totalCents: 14_500,
  },
  {
    number: 512, channel: "glovo", channelLabel: "Glovo", status: "preparing", target: "#88230",
    elapsedMinutes: 18, createdAt: minutesAgo(18),
    items: [{ name: "TIRADITO", quantity: 1 }, { name: "Chicha morada", quantity: 1 }],
    totalCents: 6_500,
  },
];

const statusMeta: Record<string, { label: string; variant: "info" | "success" | "secondary" }> = {
  sent: { label: "Enviada", variant: "info" },
  preparing: { label: "Preparando", variant: "info" },
  ready: { label: "Lista", variant: "success" },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Ícono neutro por tipo de canal — la identidad la da la etiqueta, no el color. */
function ChannelIcon({ id }: { id: string }) {
  if (id === "whatsapp") return <MessageCircle className="size-4" aria-hidden />;
  if (id === "qr") return <UtensilsCrossed className="size-4" aria-hidden />;
  return <Bike className="size-4" aria-hidden />;
}

function costLabel(channel: SalesChannel): string {
  if (channel.commissionPct && channel.commissionPct > 0) return `${channel.commissionPct}% de comisión`;
  if (channel.fixedCostCents && channel.fixedCostCents > 0) return `${money(channel.fixedCostCents)}/mes`;
  return "Sin costo";
}

function itemsSummary(items: FeedApiItem[]): string {
  return items.map((i) => `${i.quantity}× ${i.name}`).join(" · ") || "—";
}

// ── Card de canal ───────────────────────────────────────────────────────────

function ChannelCard({
  channel,
  syncing,
  onSync,
  onTogglePause,
  simulatorOpen,
  onToggleSimulator,
  sending,
  onSendTestOrder,
}: {
  channel: SalesChannel;
  syncing: boolean;
  onSync: () => void;
  onTogglePause: () => void;
  simulatorOpen: boolean;
  onToggleSimulator: () => void;
  sending: boolean;
  onSendTestOrder: () => void;
}) {
  const hasSimulator = AGGREGATORS.has(channel.id);
  return (
    <Card className={cn("transition-opacity", channel.paused && "opacity-70")}>
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <ChannelIcon id={channel.id} />
            <div>
              <p className="font-semibold leading-tight">{channel.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("size-2 rounded-full", healthDot[channel.health])} aria-hidden />
                {channel.healthLabel}
                {channel.paused && <span aria-hidden>·</span>}
                {channel.paused && <span className="font-medium">Pausada</span>}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0">
            {channel.ordersToday} órdenes hoy
          </Badge>
        </div>

        <div className="text-sm">
          <p className="font-medium tabular-nums">{costLabel(channel)}</p>
          <p className="text-xs text-muted-foreground">{channel.detail}</p>
        </div>

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={onSync} disabled={syncing || channel.paused}>
            <RefreshCw className={cn(syncing && "animate-spin")} aria-hidden />
            {syncing ? "Sincronizando…" : "Sincronizar menú"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onTogglePause}
            aria-pressed={channel.paused}
            aria-label={channel.paused ? `Reactivar tienda en ${channel.name}` : `Pausar tienda en ${channel.name}`}
          >
            {channel.paused ? <Play aria-hidden /> : <Pause aria-hidden />}
            {channel.paused ? "Reactivar" : "Pausar tienda"}
          </Button>
        </div>

        {hasSimulator && (
          <div className="rounded-lg border border-dashed bg-muted/30">
            <button
              type="button"
              onClick={onToggleSimulator}
              aria-expanded={simulatorOpen}
              className="flex w-full items-center gap-2 px-3 py-2 text-left"
            >
              <FlaskConical className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="text-xs font-medium">Simulador de pedido</span>
              {simulatorOpen ? (
                <ChevronUp className="ml-auto size-3.5 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronDown className="ml-auto size-3.5 text-muted-foreground" aria-hidden />
              )}
            </button>
            {simulatorOpen && (
              <div className="space-y-2 border-t border-dashed px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  Crea una orden real de {channel.name} vía webhook — entra aceptada al feed y a cocina.
                </p>
                <Button size="sm" variant="outline" className="w-full" onClick={onSendTestOrder} disabled={sending}>
                  <RefreshCw className={cn(sending && "animate-spin")} aria-hidden />
                  {sending ? "Enviando…" : "Enviar pedido de prueba"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────

export default function CanalesPage() {
  const [channels, setChannels] = useState<SalesChannel[]>(CHANNELS);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "success" | "danger"; text: string } | null>(null);

  // Simulador de pedido (un panel abierto a la vez)
  const [simulatorFor, setSimulatorFor] = useState<string | null>(null);
  const [sendingPlatform, setSendingPlatform] = useState<string | null>(null);

  // Feed unificado real
  const [feed, setFeed] = useState<FeedApiOrder[]>(MOCK_FEED);
  const [feedSource, setFeedSource] = useState<"loading" | "live" | "demo">("loading");

  const syncTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
    },
    [],
  );

  const refreshFeed = useCallback(async (silent: boolean) => {
    if (!silent) setFeedSource("loading");
    try {
      const res = await fetch("/api/orders?active=1", { headers: ORG_HEADERS, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { orders?: FeedApiOrder[] };
      const orders = data.orders ?? [];
      setFeed(orders.length > 0 ? orders : []);
      setFeedSource("live");
    } catch {
      setFeed(MOCK_FEED);
      setFeedSource("demo");
    }
  }, []);

  // Refresco automático cada 10 s — el interval se limpia al desmontar.
  useEffect(() => {
    void refreshFeed(false);
    const interval = window.setInterval(() => {
      void refreshFeed(true);
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [refreshFeed]);

  /** Filtra a los canales del feed y muestra los más recientes primero. */
  const feedRows = feed
    .filter((o) => FEED_CHANNEL_IDS.has(o.channel))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleSync = (channel: SalesChannel) => {
    setSyncingId(channel.id);
    // Mock: la sincronización real de catálogos llega con cada integrador.
    syncTimer.current = window.setTimeout(() => {
      setSyncingId(null);
      setBanner({ kind: "success", text: `Menú enviado a ${channel.name}. Los cambios se publican en un par de minutos.` });
    }, 1_200);
  };

  const handleTogglePause = (id: string) => {
    const channel = channels.find((c) => c.id === id);
    if (!channel) return;
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, paused: !c.paused } : c)));
    setBanner(
      channel.paused
        ? { kind: "success", text: `Tienda reactivada en ${channel.name}.` }
        : { kind: "success", text: `Tienda pausada en ${channel.name}. No recibirá órdenes.` },
    );
  };

  /** POST /api/aggregators/webhook — el mismo contrato que las plataformas firmadas. */
  const sendTestOrder = async (platform: string) => {
    if (sendingPlatform) return;
    setSendingPlatform(platform);
    setBanner(null);
    try {
      const res = await fetch("/api/aggregators/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgSlug: ORG_SLUG,
          platform,
          externalId: `#${Math.floor(10_000 + Math.random() * 89_999)}`,
          items: [{ name: "Ceviche de pescado", quantity: 2, unitPriceCents: 2_500 }],
          totalCents: 5_000,
        }),
      });
      const data = (await res.json()) as AggregatorResponse;
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setBanner({
        kind: "success",
        text:
          data.orderNumber != null
            ? `Orden #${data.orderNumber} aceptada automáticamente`
            : "Orden aceptada automáticamente",
      });
      await refreshFeed(true);
    } catch (error) {
      setBanner({
        kind: "danger",
        text: `No se pudo crear el pedido de prueba: ${error instanceof Error ? error.message : "error de red"}.`,
      });
    } finally {
      setSendingPlatform(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Canales</h1>
          <p className="text-sm text-muted-foreground">
            {channels.filter((c) => c.health === "connected" && !c.paused).length} de {channels.length} operando con
            normalidad
          </p>
        </div>
      </div>

      {banner && (
        <div
          role="status"
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
            banner.kind === "success"
              ? "border-success/20 bg-success/10 text-success-text"
              : "border-destructive/20 bg-destructive/10 text-danger-text",
          )}
        >
          <span>{banner.text}</span>
          <Button variant="ghost" size="icon" onClick={() => setBanner(null)} aria-label="Descartar aviso">
            <X />
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            syncing={syncingId === channel.id}
            onSync={() => handleSync(channel)}
            onTogglePause={() => handleTogglePause(channel.id)}
            simulatorOpen={simulatorFor === channel.id}
            onToggleSimulator={() => setSimulatorFor((prev) => (prev === channel.id ? null : channel.id))}
            sending={sendingPlatform === channel.id}
            onSendTestOrder={() => void sendTestOrder(channel.id)}
          />
        ))}
      </div>

      <section aria-labelledby="feed-unificado" className="space-y-3">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
            <div className="flex items-center gap-3">
              <h2 id="feed-unificado" className="font-semibold tracking-tight">
                Feed unificado
              </h2>
              {feedSource === "live" && (
                <Badge variant="success">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden /> en vivo
                </Badge>
              )}
              {feedSource === "demo" && (
                <Badge variant="warning">
                  <span className="size-1.5 rounded-full bg-warning" aria-hidden /> demo
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Se refresca cada 10 s</span>
              <Button variant="outline" size="sm" onClick={() => void refreshFeed(false)}>
                <RefreshCw className={cn("size-3.5", feedSource === "loading" && "animate-spin")} aria-hidden />
                Actualizar
              </Button>
            </div>
          </div>
          <ul>
            {feedRows.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                Sin órdenes activas en estos canales — usa un simulador para crear una.
              </li>
            )}
            {feedRows.map((o) => {
              const meta = statusMeta[o.status] ?? { label: o.status, variant: "secondary" as const };
              return (
                <li
                  key={`${o.number}-${o.createdAt}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3 text-sm last:border-0 hover:bg-muted/30"
                >
                  <span className="w-14 font-semibold tabular-nums">
                    {o.number != null ? `#${String(o.number).padStart(4, "0")}` : "—"}
                  </span>
                  <Badge variant="outline" className="w-24 justify-center">
                    {o.channelLabel}
                  </Badge>
                  <span className="w-36 truncate tabular-nums text-muted-foreground">{o.target}</span>
                  <span className="min-w-0 flex-1 truncate">{itemsSummary(o.items)}</span>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  <span className="w-20 text-right font-semibold tabular-nums">{money(o.totalCents)}</span>
                  <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                    {o.elapsedMinutes} min
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="flex items-start gap-2.5 rounded-xl border border-info/20 bg-info/10 px-4 py-3 text-sm text-info-text">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Producción: webhooks firmados de cada plataforma + auto-aceptación configurable. Demo: simulador con el
            mismo contrato.
          </p>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        El estado del canal se lee por el punto: verde conectado, ámbar degradado, rojo caído.
        {channels.some((c) => c.health === "down") && " Revisa los canales en rojo antes del pico de la noche."}
      </p>
    </div>
  );
}
