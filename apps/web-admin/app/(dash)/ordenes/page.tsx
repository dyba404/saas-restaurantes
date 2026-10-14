"use client";

import { formatMoney } from "@rest/printer";
import { Badge, Button, Card, cn } from "@rest/ui";
import { Eye, RefreshCw, Wallet } from "lucide-react";
import { PayModal, ORG_HEADERS } from "@/components/pay-modal";
import { useCallback, useEffect, useState } from "react";

// ── Tipos del API (GET /api/orders) ─────────────────────────────────────────

interface ApiOrderItem {
  name: string;
  quantity: number;
  notes?: string;
  modifiers?: string[];
}

interface ApiOrder {
  number: number | null;
  channel: string;
  channelLabel: string;
  status: "sent" | "preparing" | "ready" | "served" | "paid" | "void";
  target: string;
  staffName?: string | null;
  elapsedMinutes: number;
  createdAt: string;
  items: ApiOrderItem[];
  totalCents: number;
}


const MOCK_ORDERS: ApiOrder[] = [
  {
    number: 512, channel: "pos", channelLabel: "POS", status: "paid", target: "Mesa 4",
    elapsedMinutes: 32, createdAt: new Date(Date.now() - 32 * 60_000).toISOString(),
    items: [{ name: "Ceviche de pescado", quantity: 2, modifiers: ["sin cebolla"] }], totalCents: 5_000,
  },
  {
    number: 513, channel: "whatsapp", channelLabel: "WhatsApp", status: "sent", target: "+51 9…",
    elapsedMinutes: 3, createdAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    items: [{ name: "Tiraditos", quantity: 2, notes: "sin picante" }], totalCents: 10_000,
  },
  {
    number: 511, channel: "glovo", channelLabel: "Glovo", status: "preparing", target: "#88230",
    elapsedMinutes: 18, createdAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    items: [{ name: "Causa limeña", quantity: 1 }, { name: "Ceviche de pescado", quantity: 3 }],
    totalCents: 13_000,
  },
];

const statusMeta = {
  sent: { label: "Enviada", variant: "info" as const },
  preparing: { label: "Preparando", variant: "info" as const },
  ready: { label: "Lista", variant: "secondary" as const },
  served: { label: "Servida", variant: "secondary" as const },
  paid: { label: "Pagada", variant: "success" as const },
  void: { label: "Anulada", variant: "danger" as const },
} as const;

export default function OrdenesPage() {
  const [orders, setOrders] = useState<ApiOrder[]>(MOCK_ORDERS);
  const [source, setSource] = useState<"loading" | "live" | "demo">("loading");
  const [detail, setDetail] = useState<ApiOrder | null>(null);
  const [paying, setPaying] = useState<ApiOrder | null>(null);
  const [filter, setFilter] = useState<"activas" | "pagadas" | "todas">("activas");

  const refresh = useCallback(async () => {
    setSource("loading");
    try {
      const res = await fetch("/api/orders", { headers: ORG_HEADERS });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { orders: ApiOrder[] };
      setOrders(data.orders.length > 0 ? data.orders : MOCK_ORDERS);
      setSource(data.orders.length > 0 ? "live" : "demo");
    } catch {
      setOrders(MOCK_ORDERS);
      setSource("demo");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = orders.filter((o) =>
    filter === "activas" ? ["sent", "preparing", "ready", "served"].includes(o.status)
    : filter === "pagadas" ? o.status === "paid"
    : true,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Órdenes</h1>
            <p className="text-sm text-muted-foreground">Todos los canales en un solo lugar</p>
          </div>
          {source === "live" && (
            <Badge variant="success">
              <span className="size-1.5 rounded-full bg-success" /> en vivo
            </Badge>
          )}
          {source === "demo" && (
            <Badge variant="warning">
              <span className="size-1.5 rounded-full bg-warning" /> demo
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5 text-sm">
            {(["activas", "pagadas", "todas"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-3 py-1.5 capitalize transition-colors",
                  filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="size-4" /> Actualizar
          </Button>
        </div>
      </div>

      <Card className="overflow-visible">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Hora</th>
              <th className="px-4 py-3 font-medium">Canal</th>
              <th className="px-4 py-3 font-medium">Destino</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No hay órdenes en este filtro
                </td>
              </tr>
            )}
            {visible.map((o) => (
              <tr key={`${o.number}-${o.createdAt}`} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-semibold tabular-nums">
                  {o.number != null ? String(o.number).padStart(4, "0") : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {new Date(o.createdAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{o.channelLabel}</Badge>
                </td>
                <td className="px-4 py-3">{o.target}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {formatMoney(o.totalCents)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusMeta[o.status].variant}>{statusMeta[o.status].label}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(o)}>
                      <Eye className="size-4" /> Ver
                    </Button>
                    {o.status !== "paid" && o.status !== "void" && (
                      <Button size="sm" onClick={() => setPaying(o)}>
                        <Wallet className="size-4" /> Cobrar
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {detail && <DetailSheet order={detail} onClose={() => setDetail(null)} />}
      {paying && (
        <PayModal
          order={paying}
          onClose={() => setPaying(null)}
          onPaid={(number) => {
            setOrders((prev) =>
              prev.map((o) => (o.number === number ? { ...o, status: "paid" as const } : o)),
            );
            setPaying(null);
          }}
        />
      )}
    </div>
  );
}

// ── Detalle de orden ────────────────────────────────────────────────────────

function DetailSheet({ order, onClose }: { order: ApiOrder; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-label={`Detalle de la orden ${order.number ?? ""}`}
    >
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Orden</p>
            <h2 className="text-2xl font-bold tabular-nums">
              {order.number != null ? `#${order.number}` : "Local"}
            </h2>
          </div>
          <Badge variant={statusMeta[order.status].variant}>{statusMeta[order.status].label}</Badge>
        </div>

        <dl className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          <div className="flex justify-between"><dt>Canal</dt><dd className="font-medium text-foreground">{order.channelLabel}</dd></div>
          <div className="flex justify-between"><dt>Destino</dt><dd className="font-medium text-foreground">{order.target}</dd></div>
          <div className="flex justify-between"><dt>Antigüedad</dt><dd className="font-medium text-foreground">{order.elapsedMinutes} min</dd></div>
        </dl>

        <h3 className="mt-6 border-t pt-4 text-sm font-semibold">Productos</h3>
        <ul className="mt-2 space-y-2">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3 text-sm">
              <span>
                <span className="font-bold">{item.quantity}×</span> {item.name}
                {item.modifiers && item.modifiers.length > 0 && (
                  <span className="block pl-6 text-xs text-muted-foreground">
                    {item.modifiers.join(" · ")}
                  </span>
                )}
                {item.notes && (
                  <span className="block pl-6 text-xs font-medium text-warning-text">* {item.notes}</span>
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-between border-t pt-4 text-lg font-bold">
          <span>TOTAL</span>
          <span className="tabular-nums">{formatMoney(order.totalCents)}</span>
        </div>

        <Button className="mt-6 w-full" variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
