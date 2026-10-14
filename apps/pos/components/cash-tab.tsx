"use client";

/**
 * Pestaña Caja (corte de turno): ventas por método (de los pagos de la sesión,
 * persistidos en localStorage), propinas, arqueo con conteo físico y diferencia
 * semáforo (Badge verde/ámbar/rojo), impresión del corte X e historial mock.
 */
import { Banknote, CreditCard, Layers, Printer, RotateCcw, Wallet } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { formatMoney, renderReceipt } from "@rest/printer";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, cn } from "@rest/ui";
import { digitsToCents } from "@/lib/pos-types";
import { buildCutReceipt } from "@/lib/receipt";
import type { SessionPayment } from "@/lib/pos-types";
import { Numpad } from "./numpad";

interface CashTabProps {
  payments: SessionPayment[];
  shiftStartedAt: string;
  organizationName: string;
  locationName: string;
  countedDigits: string;
  onCountedDigitsChange: (digits: string) => void;
  onPrintCut: (lines: string[]) => void;
  onResetShift: () => void;
}

/** Historial mock de cortes cerrados (solo lectura). */
const CUT_HISTORY = [
  { label: "Ayer · cierre 23:12", tickets: 92, tipsCents: 142_300, totalCents: 1_845_050 },
  { label: "Anteayer · cierre 22:58", tickets: 85, tipsCents: 118_900, totalCents: 1_689_000 },
];

const MAX_COUNT_DIGITS = 8;

export function CashTab({
  payments,
  shiftStartedAt,
  organizationName,
  locationName,
  countedDigits,
  onCountedDigitsChange,
  onPrintCut,
  onResetShift,
}: CashTabProps) {
  const summary = useMemo(() => {
    const cash = payments.filter((p) => p.method === "cash");
    const card = payments.filter((p) => p.method === "card");
    const mixed = payments.filter((p) => p.method === "mixed");
    const sum = (list: SessionPayment[]) =>
      list.reduce((total, p) => total + p.amountCents, 0);
    return {
      cash,
      card,
      mixed,
      cashTotal: sum(cash),
      cardTotal: sum(card),
      mixedTotal: sum(mixed),
      totalSalesCents: sum(payments),
      tipsCents: payments.reduce((total, p) => total + p.tipCents, 0),
      tickets: payments.length,
      // En gaveta: cobros en efectivo (ya con cambio descontado) + parte en
      // efectivo de los mixtos (exactos, sin cambio).
      expectedCashCents: payments.reduce((total, p) => total + p.cashInDrawerCents, 0),
    };
  }, [payments]);

  const countedCents = digitsToCents(countedDigits);
  const counted = countedDigits !== "";
  const diffCents = countedCents - summary.expectedCashCents;
  const absDiff = Math.abs(diffCents);
  const verdict = !counted
    ? null
    : absDiff <= 500
      ? { variant: "success" as const, label: "Cuadra" }
      : absDiff <= 5_000
        ? { variant: "warning" as const, label: "Diferencia menor" }
        : { variant: "danger" as const, label: "Revisar caja" };

  const shiftLabel = new Date(shiftStartedAt).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  function typeDigit(digit: string) {
    onCountedDigitsChange(
      countedDigits.length >= MAX_COUNT_DIGITS ? countedDigits : `${countedDigits}${digit}`,
    );
  }

  function printCut() {
    const doc = buildCutReceipt({
      organizationName,
      locationName,
      isoDate: new Date().toISOString(),
      rows: [
        { label: "Ventas efectivo", count: summary.cash.length, totalCents: summary.cashTotal },
        { label: "Ventas tarjeta", count: summary.card.length, totalCents: summary.cardTotal },
        { label: "Ventas mixtas", count: summary.mixed.length, totalCents: summary.mixedTotal },
        {
          label: "Propinas",
          count: payments.filter((p) => p.tipCents > 0).length,
          totalCents: summary.tipsCents,
        },
      ],
      tickets: summary.tickets,
      totalSalesCents: summary.totalSalesCents,
      expectedCashCents: summary.expectedCashCents,
      countedCents: counted ? countedCents : null,
    });
    onPrintCut(renderReceipt(doc, "mm58"));
  }

  return (
    <div className="mx-auto h-full max-w-3xl space-y-3 overflow-y-auto p-3">
      {/* Resumen del turno */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 p-4">
          <div className="flex items-center gap-2">
            <Wallet className="size-5 text-primary" />
            <CardTitle className="text-base">Turno en curso</CardTitle>
          </div>
          <Badge variant="secondary">desde {shiftLabel}</Badge>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Ventas</p>
              <p className="text-lg font-bold tabular-nums">
                {formatMoney(summary.totalSalesCents)}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Tickets</p>
              <p className="text-lg font-bold tabular-nums">{summary.tickets}</p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Propinas</p>
              <p className="text-lg font-bold tabular-nums">
                {formatMoney(summary.tipsCents)}
              </p>
            </div>
          </div>

          {/* Ventas por método */}
          <div className="divide-y rounded-xl border">
            <MethodRow
              icon={<Banknote className="size-4" />}
              label="Efectivo"
              count={summary.cash.length}
              totalCents={summary.cashTotal}
            />
            <MethodRow
              icon={<CreditCard className="size-4" />}
              label="Tarjeta"
              count={summary.card.length}
              totalCents={summary.cardTotal}
            />
            <MethodRow
              icon={<Layers className="size-4" />}
              label="Mixto"
              count={summary.mixed.length}
              totalCents={summary.mixedTotal}
            />
          </div>
        </CardContent>
      </Card>

      {/* Arqueo */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Arqueo de caja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Esperado en gaveta</p>
              <p className="text-xl font-bold tabular-nums">
                {formatMoney(summary.expectedCashCents)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Conteo físico</p>
              <p className="text-2xl font-bold tabular-nums">
                {formatMoney(countedCents)}
              </p>
            </div>
          </div>
          {counted && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-muted-foreground">Diferencia:</span>
              <span
                className={cn(
                  "font-bold tabular-nums",
                  diffCents === 0
                    ? "text-success-text"
                    : diffCents > 0
                      ? "text-info-text"
                      : "text-danger-text",
                )}
              >
                {diffCents > 0 ? "+" : ""}
                {formatMoney(diffCents)}
              </span>
              {verdict && <Badge variant={verdict.variant}>{verdict.label}</Badge>}
            </div>
          )}
          <Numpad
            onDigit={typeDigit}
            onClear={() => onCountedDigitsChange("")}
            onBackspace={() => onCountedDigitsChange(countedDigits.slice(0, -1))}
            className="mx-auto max-w-xs"
          />
        </CardContent>
      </Card>

      {/* Acciones del corte */}
      <div className="flex gap-2">
        <Button size="lg" className="h-12 flex-1" onClick={printCut}>
          <Printer className="size-5" /> Imprimir corte X
        </Button>
        <Button size="lg" variant="outline" className="h-12" onClick={onResetShift}>
          <RotateCcw className="size-4" /> Reiniciar turno
        </Button>
      </div>

      {/* Historial de cortes cerrados (mock) */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Cortes anteriores</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="divide-y">
            {CUT_HISTORY.map((cut) => (
              <div
                key={cut.label}
                className="flex items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium">{cut.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {cut.tickets} tickets · propinas {formatMoney(cut.tipsCents)}
                  </p>
                </div>
                <span className="font-bold tabular-nums">{formatMoney(cut.totalCents)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MethodRow({
  icon,
  label,
  count,
  totalCents,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  totalCents: number;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
      <Badge variant="outline" className="ml-1">
        {count}
      </Badge>
      <span className="ml-auto text-sm font-bold tabular-nums">
        {formatMoney(totalCents)}
      </span>
    </div>
  );
}
