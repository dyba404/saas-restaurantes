"use client";

import { formatMoney } from "@rest/printer";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, cn, Input } from "@rest/ui";
import { Banknote, CreditCard, RefreshCw, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PayModal, ORG_HEADERS, type PayableOrder } from "@/components/pay-modal";

/**
 * Caja de escritorio — docs/02 módulo 4. Para el cajero que trabaja en computadora:
 * cobra las órdenes de todos los canales y hace el arqueo con los totales REALES
 * del día (todas las cajas: tablets POS, admin y canales).
 */

interface DayTotals {
  totals: Record<string, { count: number; amountCents: number; tipCents: number }>;
  salesCents: number;
  tickets: number;
  tipCents: number;
  expectedCashCents: number;
  cortes: Array<{ at: string; countedCents: number; expectedCents: number; differenceCents: number }>;
}

interface OpenOrder {
  number: number | null;
  channelLabel: string;
  target: string;
  status: string;
  createdAt: string;
  items: Array<{ name: string; quantity: number }>;
  totalCents: number;
}

const METHOD_META: Record<string, { label: string; icon: typeof Banknote }> = {
  cash: { label: "Efectivo", icon: Banknote },
  card: { label: "Tarjeta", icon: CreditCard },
  mercadopago: { label: "MercadoPago", icon: Wallet },
  stripe: { label: "Stripe", icon: CreditCard },
  mixed: { label: "Mixto", icon: Wallet },
  payment_link: { label: "Link de pago", icon: Wallet },
};

export default function CajaPage() {
  const [totals, setTotals] = useState<DayTotals | null>(null);
  const [source, setSource] = useState<"loading" | "live" | "demo">("loading");
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [paying, setPaying] = useState<OpenOrder | null>(null);
  const [counted, setCounted] = useState<string>("");
  const [savingCorte, setSavingCorte] = useState(false);
  const [corteBanner, setCorteBanner] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setSource("loading");
    try {
      const [payRes, ordersRes] = await Promise.all([
        fetch("/api/payments", { headers: ORG_HEADERS }),
        fetch("/api/orders?active=1", { headers: ORG_HEADERS }),
      ]);
      if (!payRes.ok || !ordersRes.ok) throw new Error("api");
      const dayTotals = (await payRes.json()) as DayTotals;
      const orders = (await ordersRes.json()) as { orders: OpenOrder[] };
      setTotals(dayTotals);
      setOpenOrders(orders.orders);
      setSource("live");
    } catch {
      setTotals({
        totals: {},
        salesCents: 0,
        tickets: 0,
        tipCents: 0,
        expectedCashCents: 0,
        cortes: [],
      });
      setOpenOrders([]);
      setSource("demo");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const countedCents = counted === "" ? null : Math.round(Number(counted) * 100);
  const expected = totals?.expectedCashCents ?? 0;
  const difference = countedCents != null ? countedCents - expected : null;
  const differenceTone =
    difference == null
      ? "text-muted-foreground"
      : Math.abs(difference) <= 100 // tolerancia de $1
        ? "text-success-text"
        : Math.abs(difference) <= 2000
          ? "text-warning-text"
          : "text-danger-text";

  async function registrarCorte() {
    if (countedCents == null || !totals) return;
    setSavingCorte(true);
    setCorteBanner(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ORG_HEADERS },
        body: JSON.stringify({ countedCents }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        corte?: { differenceCents: number; expectedCents: number };
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setCorteBanner(data.error ?? "No se pudo registrar el corte");
        return;
      }
      const diff = data.corte!.differenceCents;
      setCorteBanner(
        `Corte registrado · esperado ${formatMoney(data.corte!.expectedCents)} · diferencia ${formatMoney(diff)}`,
      );
      setCounted("");
      void refresh();
    } catch {
      setCorteBanner("Error de red — intenta de nuevo");
    } finally {
      setSavingCorte(false);
    }
  }

  function markPaid(number: number | null) {
    setOpenOrders((prev) => prev.filter((o) => o.number !== number));
    void refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Caja</h1>
            <p className="text-sm text-muted-foreground">
              Cobros y arqueo del día — totales de todas las cajas y canales
            </p>
          </div>
          {source === "live" && (
            <Badge variant="success">
              <span className="size-1.5 rounded-full bg-success" /> en vivo
            </Badge>
          )}
          {source === "demo" && (
            <Badge variant="warning">
              <span className="size-1.5 rounded-full bg-warning" /> sin conexión
            </Badge>
          )}
        </div>
        <Button variant="outline" onClick={() => void refresh()}>
          <RefreshCw className="size-4" /> Actualizar
        </Button>
      </div>

      {/* Totales reales del día */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Ventas del día</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {formatMoney(totals?.salesCents ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {totals?.tickets ?? 0} tickets · propinas {formatMoney(totals?.tipCents ?? 0)}
            </p>
          </CardContent>
        </Card>
        {Object.entries(METHOD_META).map(([method, meta]) => {
          const bucket = totals?.totals[method];
          if (!bucket || bucket.count === 0) return null;
          const Icon = meta.icon;
          return (
            <Card key={method}>
              <CardContent className="p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Icon className="size-3.5" /> {meta.label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {formatMoney(bucket.amountCents)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{bucket.count} cobros</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cola para cobrar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pendientes de cobrar ({openOrders.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openOrders.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay órdenes pendientes de cobro
              </p>
            )}
            {openOrders.map((o) => (
              <div
                key={`${o.number}-${o.createdAt}`}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                <span className="text-sm font-bold tabular-nums">
                  {o.number != null ? `#${o.number}` : "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.target}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.channelLabel} · {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{formatMoney(o.totalCents)}</span>
                <Button size="sm" onClick={() => setPaying(o)}>
                  <Wallet className="size-4" /> Cobrar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Arqueo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Arqueo de caja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
              <span className="text-sm text-muted-foreground">Efectivo esperado en gaveta</span>
              <span className="text-2xl font-bold tabular-nums">
                {formatMoney(expected)}
              </span>
            </div>

            <div className="space-y-2">
              <label htmlFor="counted" className="text-sm font-medium">
                Conteo físico
              </label>
              <Input
                id="counted"
                type="number"
                min={0}
                inputMode="decimal"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                placeholder="0.00"
                className="h-12 text-lg font-semibold tabular-nums"
              />
              {difference != null && (
                <p className={cn("text-sm font-medium", differenceTone)}>
                  Diferencia: {formatMoney(difference)}
                  {Math.abs(difference) <= 100
                    ? " · cuadrada"
                    : difference > 0
                      ? " · sobrante"
                      : " · faltante"}
                </p>
              )}
            </div>

            {corteBanner && (
              <p className="rounded-md border border-success/20 bg-success/10 px-3 py-2 text-sm text-success-text">
                {corteBanner}
              </p>
            )}

            <Button
              className="w-full"
              disabled={countedCents == null || savingCorte}
              onClick={() => void registrarCorte()}
            >
              <Banknote className="size-4" />
              {savingCorte ? "Registrando…" : "Registrar corte de caja"}
            </Button>

            {totals && totals.cortes.length > 0 && (
              <div className="border-t pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cortes anteriores
                </p>
                <ul className="space-y-1.5 text-sm">
                  {totals.cortes.map((corte) => (
                    <li key={corte.at} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">
                        {new Date(corte.at).toLocaleTimeString("es-PE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="tabular-nums">
                        conteo {formatMoney(corte.countedCents)} · esperado{" "}
                        {formatMoney(corte.expectedCents)}
                      </span>
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          corte.differenceCents === 0
                            ? "text-success-text"
                            : Math.abs(corte.differenceCents) <= 100
                              ? "text-success-text"
                              : "text-danger-text",
                        )}
                      >
                        {formatMoney(corte.differenceCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {paying && (
        <PayModal
          order={paying as PayableOrder}
          onClose={() => setPaying(null)}
          onPaid={markPaid}
        />
      )}
    </div>
  );
}
