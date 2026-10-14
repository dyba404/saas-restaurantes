"use client";

import { formatMoney, renderReceipt } from "@rest/printer";
import { Button, cn } from "@rest/ui";
import { useEffect, useState } from "react";

export const ORG_HEADERS = { "X-Org-Slug": "cevicheria-el-muelle" };

export interface PayableOrder {
  number: number | null;
  channelLabel: string;
  target: string;
  items: Array<{ name: string; quantity: number; notes?: string; modifiers?: string[] }>;
  totalCents: number;
}

/**
 * Flujo de cobro compartido (Órdenes y Caja): efectivo con cálculo de cambio,
 * tarjeta, recibo en pantalla y nota honesta de impresión.
 * El pago se registra vía POST /api/sync (order.pay, idempotente por clientUuid).
 */
export function PayModal({
  order,
  onClose,
  onPaid,
}: {
  order: PayableOrder;
  onClose: () => void;
  onPaid: (number: number | null) => void;
}) {
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [received, setReceived] = useState<number | null>(null);
  const [state, setState] = useState<"form" | "saving" | "receipt">("form");
  const [error, setError] = useState<string | null>(null);
  const [receiptLines, setReceiptLines] = useState<string[]>([]);

  const change = received != null ? Math.max(0, received * 100 - order.totalCents) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function confirm() {
    if (!order.number) {
      setError("Las órdenes locales se cobran en la tablet del POS");
      return;
    }
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ORG_HEADERS },
        body: JSON.stringify({
          events: [
            {
              clientUuid: crypto.randomUUID(),
              type: "order.pay",
              payload: {
                number: order.number,
                method,
                amountCents: received != null ? Math.min(received * 100, order.totalCents) : order.totalCents,
                tipCents: 0,
                changeCents: change ?? 0,
              },
            },
          ],
        }),
      });
      const data = (await res.json()) as { acks?: Array<{ ok: boolean; error?: string }> };
      const ack = data.acks?.[0];
      if (!res.ok || !ack?.ok) {
        setError(ack?.error ?? "No se pudo registrar el pago");
        setState("form");
        return;
      }
      const unit = Math.round(order.totalCents / Math.max(1, order.items.reduce((s, i) => s + i.quantity, 0)));
      setReceiptLines(
        renderReceipt({
          storeName: "Cevichería El Muelle",
          locationName: "Centro",
          ticketNumber: `#${order.number}`,
          channel: order.channelLabel,
          table: order.target,
          isoDate: new Date().toISOString(),
          items: order.items.map((item) => ({
            quantity: item.quantity,
            name: item.name,
            unitPriceCents: unit,
            totalCents: unit * item.quantity,
            modifiers: item.modifiers,
            notes: item.notes,
          })),
          subtotalCents: order.totalCents,
          totalCents: order.totalCents,
          paymentLine:
            method === "cash"
              ? `Efectivo ${formatMoney(received != null ? received * 100 : order.totalCents)} · Cambio ${formatMoney(change ?? 0)}`
              : "Pagado con tarjeta",
          footer: "¡Gracias por su visita!",
        }),
      );
      setState("receipt");
      onPaid(order.number);
    } catch {
      setError("Error de red — intenta de nuevo");
      setState("form");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-label="Cobrar orden"
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {state === "receipt" ? (
          <div>
            <h2 className="text-lg font-semibold">Pago registrado ✅</h2>
            <pre className="mt-4 max-h-72 overflow-auto whitespace-pre rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-5">
              {receiptLines.join("\n")}
            </pre>
            <p className="mt-3 rounded-md border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning-text">
              La boleta se imprime en el dispositivo con impresora térmica conectada — este
              equipo no tiene ninguna (configúrala con Web Bluetooth en el POS).
            </p>
            <Button className="mt-4 w-full" onClick={onClose}>
              Listo
            </Button>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold">
              Cobrar {order.number != null ? `#${order.number}` : "orden local"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {order.target} · {order.channelLabel}
            </p>

            <div className="mt-4 rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground">Total a cobrar</p>
              <p className="text-3xl font-bold tabular-nums">{formatMoney(order.totalCents)}</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {(
                [
                  ["cash", "Efectivo"],
                  ["card", "Tarjeta"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
                  className={cn(
                    "rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-colors",
                    method === value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {method === "cash" && (
              <div className="mt-3 space-y-2">
                <label className="text-sm font-medium" htmlFor="received">
                  Recibido
                </label>
                <input
                  id="received"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={received ?? ""}
                  onChange={(e) => setReceived(e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="0.00"
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-lg font-semibold tabular-nums"
                />
                <div className="flex gap-2">
                  {[order.totalCents / 100, 100, 200, 500].map((amount, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setReceived(amount)}
                      className="flex-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      {i === 0 ? "Exacto" : formatMoney(amount * 100)}
                    </button>
                  ))}
                </div>
                {change != null && (
                  <p className="text-sm text-muted-foreground">
                    Cambio:{" "}
                    <span className="font-bold tabular-nums text-foreground">{formatMoney(change)}</span>
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-danger-text">
                {error}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={
                  state === "saving" ||
                  (method === "cash" && (received == null || received * 100 < order.totalCents))
                }
                onClick={() => void confirm()}
              >
                {state === "saving" ? "Registrando…" : `Cobrar ${formatMoney(order.totalCents)}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
