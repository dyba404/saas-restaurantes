"use client";

import { Building2, Download, FileDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, cn } from "@rest/ui";
import { ORG_SLUG } from "@/lib/use-api";

const money = (cents: number) =>
  (cents / 100).toLocaleString("es-PE", { style: "currency", currency: "PEN" });
const moneyExact = money;

const ORG_HEADERS = { "X-Org-Slug": ORG_SLUG } as const;

// ── Reportes REALES por rango (GET /api/reports) ────────────────────────────

type ReportRange = "hoy" | "7d" | "30d";
const RANGES: Array<{ id: ReportRange; label: string }> = [
  { id: "hoy", label: "Hoy" },
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
];

interface RangeReport {
  label: string;
  seriesLabel: string;
  salesCents: number;
  tickets: number;
  avgTicketCents: number;
  propinasCents: number;
  series: Array<{ label: string; cents: number }>;
  byChannel: Array<{ name: string; cents: number; pct: number }>;
  byEmployee: Array<{ name: string; salesCents: number; tickets: number }>;
  topProducts: Array<{ name: string; count: number; revenueCents: number }>;
  reservations: { booked: number; seated: number; noShows: number };
}

/** CSV de las ventas del periodo (una fila por punto de la serie). */
function buildCsv(report: RangeReport): string {
  const lines: string[] = [];
  lines.push(`Reporte de ventas — ${report.label}`);
  lines.push(`Ventas;Tickets;Ticket medio;Propinas`);
  lines.push(`${report.salesCents / 100};${report.tickets};${report.avgTicketCents / 100};${report.propinasCents / 100}`);
  lines.push("");
  lines.push(report.seriesLabel);
  lines.push("Punto;Ventas");
  for (const p of report.series) lines.push(`${p.label};${p.cents / 100}`);
  lines.push("");
  lines.push("Canal;Ventas;% del total");
  for (const c of report.byChannel) lines.push(`${c.name};${c.cents / 100};${c.pct}%`);
  lines.push("");
  lines.push("Método de pago;Ventas;Tickets");
  for (const m of report.byEmployee) lines.push(`${m.name};${m.salesCents / 100};${m.tickets}`);
  lines.push("");
  lines.push("Top productos;Cantidad;Ventas");
  for (const p of report.topProducts) lines.push(`${p.name};${p.count};${p.revenueCents / 100}`);
  return lines.join("\n");
}

/** Reporte para contador: totales por método de pago con IGV referencial (18%). */
function buildAccountantCsv(report: RangeReport): string {
  const lines: string[] = [];
  lines.push("Reporte para contador");
  lines.push(`Periodo;${report.label}`);
  lines.push(`Ventas totales (incluye propinas aparte);${(report.salesCents / 100).toFixed(2)}`);
  lines.push(`Propinas;${(report.propinasCents / 100).toFixed(2)}`);
  lines.push(`Tickets;${report.tickets}`);
  lines.push(`Ticket medio;${(report.avgTicketCents / 100).toFixed(2)}`);
  lines.push(`Base imponible referencial (sin IGV 18%);${((report.salesCents / 100) / 1.18).toFixed(2)}`);
  lines.push(`IGV referencial (18%);${((report.salesCents / 100) * (0.18 / 1.18)).toFixed(2)}`);
  lines.push("");
  lines.push("Desglose por método de pago");
  lines.push("Método;Ventas;Tickets");
  for (const m of report.byEmployee) lines.push(`${m.name};${(m.salesCents / 100).toFixed(2)};${m.tickets}`);
  return lines.join("\n");
}

function downloadCsv(name: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Multi-ubicación (F4) — local real + nota honesta para el plan Multi ─────

interface MultiRow {
  id: string;
  name: string;
  salesCents: number;
  tickets: number;
  marginPct: number;
  demo: boolean;
}

interface CentroData {
  salesCents: number;
  tickets: number;
  marginPct: number;
}

const CENTRO_FALLBACK: CentroData = {
  salesCents: 0,
  tickets: 0,
  marginPct: 62,
};

function MultiUbicacion({ centro }: { centro: CentroData }) {
  const rows: MultiRow[] = [
    { id: "centro", name: "Local principal", salesCents: centro.salesCents, tickets: centro.tickets, marginPct: centro.marginPct, demo: false },
  ];
  const total = rows.reduce((acc, r) => acc + r.salesCents, 0);

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" aria-hidden />
          Multi-ubicación
        </span>
      }
      subtitle={<Badge variant="success"><span className="size-1.5 rounded-full bg-success" aria-hidden /> en vivo</Badge>}
      className="lg:col-span-2"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">Local</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Ventas (hoy)</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Tickets</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Ticket medio</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Margen est.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ticketMedio = r.tickets > 0 ? Math.round(r.salesCents / r.tickets) : 0;
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-4">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full bg-success" aria-hidden />
                      <span className="font-medium">{r.name}</span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-semibold tabular-nums">{moneyExact(r.salesCents)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">{r.tickets}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{moneyExact(ticketMedio)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">{r.marginPct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Ventas de hoy de tu local. Al agregar más locales, cada uno aparece aquí.
      </p>
    </SectionCard>
  );
}

// ── Bloques de presentación (reutilizados del diseño original) ──────────────

function RangeSelector({ range, onChange }: { range: ReportRange; onChange: (r: ReportRange) => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-card p-1" role="group" aria-label="Rango del reporte">
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          aria-pressed={range === r.id}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            range === r.id ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function SalesSeries({ report }: { report: RangeReport }) {
  const max = Math.max(...report.series.map((p) => p.cents), 1);
  const labelEvery = Math.max(1, Math.ceil(report.series.length / 10));
  return (
    <div>
      <p className="sr-only">
        {report.seriesLabel}: {report.series.map((p) => `${p.label} ${moneyExact(p.cents)}`).join(", ")}
      </p>
      <div aria-hidden className="flex h-44 items-end gap-1">
        {report.series.map((p, i) => (
          <div key={p.label} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
            <div
              className="w-full rounded-t bg-primary transition-[height]"
              style={{ height: `${max > 0 ? (p.cents / max) * 100 : 0}%` }}
              title={`${p.label}: ${moneyExact(p.cents)}`}
            />
            <span className="text-center text-[10px] tabular-nums text-muted-foreground">
              {i % labelEvery === 0 ? p.label : ""}
            </span>
          </div>
        ))}
        {report.series.length === 0 && (
          <p className="w-full py-10 text-center text-sm text-muted-foreground">
            Sin ventas cobradas en este periodo.
          </p>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ChannelBars({ report }: { report: RangeReport }) {
  const ranked = [...report.byChannel].sort((a, b) => b.cents - a.cents);
  return (
    <ul className="space-y-3">
      {ranked.map((c, i) => (
        <li key={c.name}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{c.name}</span>
            <span className="tabular-nums text-muted-foreground">
              {c.pct}% · {moneyExact(c.cents)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-primary/50")} style={{ width: `${c.pct}%` }} />
          </div>
        </li>
      ))}
      {ranked.length === 0 && <p className="text-sm text-muted-foreground">Sin cobros en el periodo.</p>}
    </ul>
  );
}

function PaymentMethods({ report }: { report: RangeReport }) {
  const max = Math.max(...report.byEmployee.map((e) => e.salesCents), 1);
  return (
    <ul className="space-y-3">
      {report.byEmployee.map((m) => (
        <li key={m.name}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{m.name}</span>
            <span className="tabular-nums text-muted-foreground">
              {money(m.salesCents)} · {m.tickets} tickets
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(m.salesCents / max) * 100}%` }} />
          </div>
        </li>
      ))}
      {report.byEmployee.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin cobros en el periodo.</p>
      )}
    </ul>
  );
}

function TopProducts({ report }: { report: RangeReport }) {
  return (
    <ol className="space-y-2">
      {report.topProducts.map((p, i) => (
        <li key={p.name} className="flex items-baseline gap-2 text-sm">
          <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
          <span className="font-medium">{p.name}</span>
          <span className="ml-auto tabular-nums text-muted-foreground">{p.count} vendidos</span>
          <span className="w-20 shrink-0 text-right font-semibold tabular-nums">{money(p.revenueCents)}</span>
        </li>
      ))}
      {report.topProducts.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin ventas cobradas en el periodo.</p>
      )}
    </ol>
  );
}

/** Reservas vs no-shows del periodo (datos reales de la tabla reservations). */
function ReservationsVsNoShows({ report }: { report: RangeReport }) {
  const { booked, seated, noShows } = report.reservations;
  const rate = booked > 0 ? Math.round((noShows / booked) * 100) : 0;
  const rows = [
    { label: "Sentadas", value: seated, shade: "bg-primary" },
    { label: "No-shows", value: noShows, shade: "bg-primary/25" },
  ];
  return (
    <div>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">{r.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", r.shade)}
                style={{ width: `${booked > 0 ? (r.value / booked) * 100 : 0}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs">
        {booked} reservas creadas en el periodo ·{" "}
        <span className={cn("font-medium", rate > 5 ? "text-danger-text" : "text-success-text")}>
          tasa de no-show {rate}%
        </span>
      </p>
    </div>
  );
}

export default function ReportesPage() {
  const [range, setRange] = useState<ReportRange>("7d");
  const [report, setReport] = useState<RangeReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError(null);
    fetch(`/api/reports?range=${range}`, { headers: ORG_HEADERS, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<RangeReport>;
      })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reportes</h1>
          <p className="text-sm text-muted-foreground">
            {report
              ? `${report.label}: ${moneyExact(report.salesCents)} en ${report.tickets} tickets · ticket medio ${moneyExact(report.avgTicketCents)}`
              : "Cargando datos reales del periodo…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeSelector range={range} onChange={setRange} />
          <Button
            variant="outline"
            disabled={!report}
            onClick={() => report && downloadCsv(`reporte-ventas-${range}.csv`, buildCsv(report))}
            aria-label="Exportar CSV con los datos visibles"
          >
            <Download aria-hidden />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            disabled={!report}
            onClick={() => report && downloadCsv(`reporte-contador-${range}.csv`, buildAccountantCsv(report))}
            aria-label="Descargar reporte para contador"
          >
            <FileDown aria-hidden />
            Reporte para contador
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          No se pudo cargar el reporte ({error}).
        </p>
      )}

      {report && (
        <div className="grid gap-3 lg:grid-cols-2">
          <SectionCard
            title={report.seriesLabel}
            subtitle={`Total ${moneyExact(report.salesCents)}`}
            className="lg:col-span-2"
          >
            <SalesSeries report={report} />
          </SectionCard>

          <SectionCard title="Ventas por canal" subtitle="participación del periodo">
            <ChannelBars report={report} />
          </SectionCard>

          <SectionCard title="Por método de pago" subtitle="ventas y tickets">
            <PaymentMethods report={report} />
          </SectionCard>

          <SectionCard title="Top productos">
            <TopProducts report={report} />
          </SectionCard>

          <SectionCard
            title="Reservas vs no-shows"
            subtitle={
              <Badge variant="outline" className="normal-case">
                {report.reservations.booked} reservas
              </Badge>
            }
          >
            <ReservationsVsNoShows report={report} />
          </SectionCard>

          <MultiUbicacion
            centro={{
              salesCents: range === "hoy" ? report.salesCents : 0,
              tickets: range === "hoy" ? report.tickets : 0,
              marginPct: 62,
            }}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Datos reales de tus cobros del periodo. El desglose por empleado llegará cuando el POS registre
        quién atendió cada orden.
      </p>
    </div>
  );
}
