"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@rest/ui";
import { ORG_SLUG } from "@/lib/use-api";

/**
 * Resumen con métricas REALES del día (GET /api/dashboard): dinero cobrado,
 * tickets, propinas, ventas por hora, top productos, mezcla por canal y
 * alertas operativas. Cero mocks.
 */

interface DashboardData {
  date: string;
  location: string;
  ventasCents: number;
  propinasCents: number;
  tickets: number;
  ticketMedioCents: number;
  porHora: Array<{ hora: number; ventas: number }>;
  top: Array<{ name: string; uds: number; ventas: number }>;
  porCanal: Array<{ channel: string; ventas: number }>;
  alertas: { agotados: number; bajoStock: number; esperando: number };
}

const money = (cents: number) =>
  (cents / 100).toLocaleString("es-PE", { style: "currency", currency: "PEN" });

const CHANNEL_LABEL: Record<string, string> = {
  pos: "POS",
  qr: "Carta QR",
  whatsapp: "WhatsApp",
  takeaway: "Para llevar",
  rappi: "Rappi",
  glovo: "Glovo",
  pedidosya: "PedidosYa",
  ubereats: "Uber Eats",
};
const CHANNEL_COLOR: Record<string, string> = {
  pos: "bg-primary",
  qr: "bg-info",
  whatsapp: "bg-success",
  takeaway: "bg-warning",
  rappi: "bg-destructive",
  glovo: "bg-destructive",
  pedidosya: "bg-destructive",
  ubereats: "bg-destructive",
};

const alertDot = {
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
} as const;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard", { headers: { "X-Org-Slug": ORG_SLUG } })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<DashboardData>;
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const fecha = new Date().toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (error) {
    return (
      <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        No se pudieron cargar las métricas ({error}). Revisa que el API esté arriba.
      </p>
    );
  }
  if (!data) {
    return <p className="text-sm text-muted-foreground">Cargando métricas del día…</p>;
  }

  const kpis = [
    { label: "Ventas hoy", value: money(data.ventasCents) },
    { label: "Tickets", value: String(data.tickets) },
    {
      label: "Ticket medio",
      value: money(data.ticketMedioCents),
    },
    { label: "Propinas", value: money(data.propinasCents) },
  ];

  const maxHora = Math.max(1, ...data.porHora.map((h) => h.ventas));
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    ventas: data.porHora.find((x) => x.hora === h)?.ventas ?? 0,
  })).filter((h) => h.hour >= 8 && h.hour <= 23);
  const maxPct = 100;
  const pctOf = (v: number) => Math.round((v / maxHora) * maxPct);

  const totalCanal = Math.max(1, data.porCanal.reduce((s, c) => s + c.ventas, 0));

  const alertas = [
    data.alertas.esperando > 0 && {
      level: "danger" as const,
      text: `${data.alertas.esperando} orden(es) esperando más de 10 min`,
    },
    data.alertas.agotados > 0 && {
      level: "warning" as const,
      text: `${data.alertas.agotados} producto(s) marcados agotados (86)`,
    },
    data.alertas.bajoStock > 0 && {
      level: "warning" as const,
      text: `${data.alertas.bajoStock} insumo(s) bajo el stock mínimo`,
    },
  ].filter(Boolean) as Array<{ level: "danger" | "warning"; text: string }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Resumen</h1>
        <p className="text-sm capitalize text-muted-foreground">
          {fecha} · Local {data.location}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Ventas por hora */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por hora</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-2">
              {hourly.map((h) => (
                <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-primary/80 transition-all hover:bg-primary"
                    style={{ height: `${h.ventas > 0 ? Math.max(4, pctOf(h.ventas)) : 2}%` }}
                    title={`${h.hour}:00 · ${money(h.ventas)}`}
                  />
                  <span className="text-[10px] text-muted-foreground">{h.hour}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top productos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 productos (hoy)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.top.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3 text-sm">
                <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {i + 1}
                </span>
                <span className="flex-1 font-medium">{p.name}</span>
                <span className="text-muted-foreground">{p.uds} uds</span>
                <span className="w-20 text-right font-semibold tabular-nums">
                  {money(p.ventas)}
                </span>
              </div>
            ))}
            {data.top.length === 0 && (
              <p className="text-sm text-muted-foreground">Aún no hay ventas cobradas hoy.</p>
            )}
          </CardContent>
        </Card>

        {/* Por canal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por canal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.porCanal.map((c) => {
              const pct = Math.round((c.ventas / totalCanal) * 100);
              return (
                <div key={c.channel} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                    <span className="text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${CHANNEL_COLOR[c.channel] ?? "bg-muted-foreground"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {data.porCanal.length === 0 && (
              <p className="text-sm text-muted-foreground">Aún no hay cobros hoy.</p>
            )}
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.map((a) => (
              <div
                key={a.text}
                className="flex items-center gap-2.5 rounded-md border bg-card px-3 py-2.5 text-sm"
              >
                <span className={`size-2 shrink-0 rounded-full ${alertDot[a.level]}`} aria-hidden />
                <span>{a.text}</span>
              </div>
            ))}
            {alertas.length === 0 && (
              <p className="text-sm text-muted-foreground">Todo en orden ✔</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
