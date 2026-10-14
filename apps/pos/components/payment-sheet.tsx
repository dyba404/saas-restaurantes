"use client";

/**
 * Flujo de cobro completo (sheet/modal): Efectivo | Tarjeta | Mixto + propina.
 * Al confirmar encola order.pay (vía onConfirm del shell), marca la orden como
 * pagada y muestra la vista previa textual del recibo (renderReceipt, 58mm).
 * Todo el dinero va en centavos; el captura de montos usa dígitos POS
 * ("1500" → $15.00) para evitar errores de punto decimal en pantalla táctil.
 */
import { Banknote, Check, CreditCard, Layers, Printer, X } from "lucide-react";
import { useState } from "react";
import { formatMoney, renderReceipt, type ReceiptDocument } from "@rest/printer";
import { thermalPrinter } from "@/lib/thermal-printer";
import { Badge, Button, Input, cn } from "@rest/ui";
import {
  digitsToCents,
  pushDigit,
  type PaymentConfirmation,
  type PaymentMethodUi,
  type PayableOrder,
} from "@/lib/pos-types";
import { buildOrderReceipt } from "@/lib/receipt";
import { Numpad } from "./numpad";

const TIP_OPTIONS = [0, 10, 15] as const;
const QUICK_CASH: Array<{ label: string; cents: number | "exact" }> = [
  { label: "Exacto", cents: "exact" },
  { label: "S/ 20", cents: 2_000 },
  { label: "S/ 50", cents: 5_000 },
  { label: "S/ 100", cents: 10_000 },
];

const METHOD_TABS: Array<{ id: PaymentMethodUi; label: string; icon: typeof Banknote }> = [
  { id: "cash", label: "Efectivo", icon: Banknote },
  { id: "card", label: "Tarjeta", icon: CreditCard },
  { id: "mixed", label: "Mixto", icon: Layers },
];

interface PaymentSheetProps {
  order: PayableOrder;
  organizationName: string;
  locationName: string;
  staffName: string;
  onClose: () => void;
  /** Encola order.pay (y order.create si hace falta) + registra el pago local. */
  onConfirm: (payment: PaymentConfirmation) => Promise<{ definitiveNumber?: number }>;
  onPrint: () => void;
}

export function PaymentSheet({
  order,
  organizationName,
  locationName,
  staffName,
  onClose,
  onConfirm,
  onPrint,
}: PaymentSheetProps) {
  const [method, setMethod] = useState<PaymentMethodUi>("cash");
  const [tipPct, setTipPct] = useState<number>(0);
  const [cashDigits, setCashDigits] = useState("");
  const [cardDigits, setCardDigits] = useState("");
  const [activeField, setActiveField] = useState<"cash" | "card">("cash");
  const [reference, setReference] = useState("");
  const [stage, setStage] = useState<"form" | "receipt">("form");
  const [confirming, setConfirming] = useState(false);
  const [receiptLines, setReceiptLines] = useState<string[]>([]);
  const [receiptDoc, setReceiptDoc] = useState<ReceiptDocument | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printSent, setPrintSent] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  const tipCents = Math.round((order.totalCents * tipPct) / 100);
  const dueCents = order.totalCents + tipCents;
  const cashValue = digitsToCents(cashDigits);
  const cardValue = digitsToCents(cardDigits);
  const mixedRemaining = dueCents - cashValue - cardValue;

  const valid =
    method === "cash"
      ? cashValue >= dueCents
      : method === "card"
        ? true
        : mixedRemaining === 0 && dueCents > 0;
  const changeCents = method === "cash" ? Math.max(0, cashValue - dueCents) : 0;

  function typeDigit(digit: string) {
    if (method === "mixed" && activeField === "card") {
      setCardDigits((prev) => pushDigit(prev, digit));
    } else {
      setCashDigits((prev) => pushDigit(prev, digit));
    }
  }

  function backspace() {
    if (method === "mixed" && activeField === "card") {
      setCardDigits((prev) => prev.slice(0, -1));
    } else {
      setCashDigits((prev) => prev.slice(0, -1));
    }
  }

  function clearActive() {
    if (method === "mixed" && activeField === "card") {
      setCardDigits("");
    } else {
      setCashDigits("");
    }
  }

  async function confirm() {
    if (!valid || confirming) return;
    const payment: PaymentConfirmation = {
      method,
      amountCents: dueCents,
      tipCents,
      changeCents,
      cashCents:
        method === "cash" ? dueCents : method === "mixed" ? cashValue : 0,
      cardCents:
        method === "card" ? dueCents : method === "mixed" ? cardValue : 0,
      reference:
        method === "card" && reference.trim() !== "" ? reference.trim() : undefined,
    };
    setConfirming(true);
    try {
      const result = await onConfirm(payment);
      const doc = buildOrderReceipt({
        organizationName,
        locationName,
        staffName,
        // Si el ack trajo folio definitivo, el recibo lo muestra.
        order:
          result.definitiveNumber != null
            ? { ...order, number: result.definitiveNumber }
            : order,
        payment,
        isoDate: new Date().toISOString(),
      });
      setReceiptLines(renderReceipt(doc, "mm58"));
      setReceiptDoc(doc);
      setPrintSent(false);
      setPrintError(null);
      setStage("receipt");
    } finally {
      setConfirming(false);
    }
  }

  /**
   * Impresión térmica real: si hay impresora conectada envía bytes ESC/POS;
   * si no, degrada a la cola honesta del POS (onPrint) sin bloquear el cobro.
   */
  async function handlePrint() {
    if (!receiptDoc) return;
    setPrinting(true);
    try {
      if (thermalPrinter.getState().status !== "connected") {
        onPrint();
        return;
      }
      await thermalPrinter.print(receiptDoc, "mm58");
      setPrintSent(true);
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : "Error de impresión");
      onPrint();
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cobrar orden"
        className="flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-card shadow-xl"
      >
        {stage === "form" ? (
          <>
            {/* Encabezado */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold leading-tight">Cobrar</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {order.table ?? order.channel}
                  {order.number != null ? ` · #${order.number}` : ""}
                  {" · "}
                  {order.items.length} productos
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={onClose}
                className="flex size-10 items-center justify-center rounded-lg border hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {/* Total + propina */}
              <div className="rounded-xl border bg-muted/40 p-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Consumo</p>
                    <p className="text-sm font-medium tabular-nums">
                      {formatMoney(order.totalCents)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total a cobrar</p>
                    <p className="text-3xl font-bold tabular-nums text-primary">
                      {formatMoney(dueCents)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Propina:
                  </span>
                  {TIP_OPTIONS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      aria-pressed={tipPct === pct}
                      onClick={() => setTipPct(pct)}
                      className={cn(
                        "h-10 min-w-14 rounded-full border-2 px-3 text-sm font-semibold transition-colors",
                        tipPct === pct
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary",
                      )}
                    >
                      {pct === 0 ? "Sin" : `${pct}%`}
                    </button>
                  ))}
                  {tipCents > 0 && (
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      +{formatMoney(tipCents)}
                    </span>
                  )}
                </div>
              </div>

              {/* Tabs de método */}
              <div className="grid grid-cols-3 gap-2">
                {METHOD_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={method === tab.id}
                    onClick={() => setMethod(tab.id)}
                    className={cn(
                      "flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-xs font-semibold transition-colors",
                      method === tab.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    <tab.icon className="size-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Efectivo */}
              {method === "cash" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Recibido</p>
                      <p className="text-2xl font-bold tabular-nums">
                        {formatMoney(cashValue)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {cashValue >= dueCents ? "CAMBIO" : "Faltan"}
                      </p>
                      <p
                        className={cn(
                          "text-4xl font-bold tabular-nums",
                          cashValue >= dueCents ? "text-success" : "text-warning-text",
                        )}
                      >
                        {formatMoney(Math.abs(dueCents - cashValue))}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {QUICK_CASH.map((quick) => (
                      <button
                        key={quick.label}
                        type="button"
                        onClick={() =>
                          setCashDigits(String(quick.cents === "exact" ? dueCents : quick.cents))
                        }
                        className="h-11 rounded-lg border bg-background text-sm font-semibold hover:border-primary"
                      >
                        {quick.label}
                      </button>
                    ))}
                  </div>
                  <Numpad
                    onDigit={typeDigit}
                    onClear={clearActive}
                    onBackspace={backspace}
                  />
                </div>
              )}

              {/* Tarjeta */}
              {method === "card" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-xl border border-info/20 bg-info/10 p-3 text-sm text-info-text">
                    <CreditCard className="mt-0.5 size-4 shrink-0" />
                    <p>Cobra con la terminal fuera de la app y registra el pago aquí.</p>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Referencia (opcional)
                    </span>
                    <Input
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="Últimos 4 dígitos o folio de la terminal"
                      className="h-11"
                    />
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Se registrarán{" "}
                    <span className="font-semibold text-foreground">
                      {formatMoney(dueCents)}
                    </span>{" "}
                    como pago con tarjeta.
                  </p>
                </div>
              )}

              {/* Mixto */}
              {method === "mixed" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setActiveField("cash")}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border-2 p-3 text-left transition-colors",
                        activeField === "cash"
                          ? "border-primary bg-primary/5"
                          : "border-border",
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Banknote className="size-4" /> Efectivo
                        {activeField === "cash" && <Badge variant="info">editando</Badge>}
                      </span>
                      <span className="text-lg font-bold tabular-nums">
                        {formatMoney(cashValue)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveField("card")}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border-2 p-3 text-left transition-colors",
                        activeField === "card"
                          ? "border-primary bg-primary/5"
                          : "border-border",
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <CreditCard className="size-4" /> Tarjeta
                        {activeField === "card" && <Badge variant="info">editando</Badge>}
                      </span>
                      <span className="text-lg font-bold tabular-nums">
                        {formatMoney(cardValue)}
                      </span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {mixedRemaining === 0 && dueCents > 0 ? (
                      <Badge variant="success">
                        <Check className="size-3" /> Suma exacta
                      </Badge>
                    ) : mixedRemaining > 0 ? (
                      <Badge variant="warning">Restan {formatMoney(mixedRemaining)}</Badge>
                    ) : (
                      <Badge variant="danger">Sobra {formatMoney(-mixedRemaining)}</Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const rest = dueCents - cashValue;
                        if (rest >= 0) setCardDigits(String(rest));
                      }}
                      className="h-10 rounded-lg border bg-background px-3 text-xs font-semibold hover:border-primary"
                    >
                      Resto en tarjeta
                    </button>
                  </div>
                  <Numpad
                    onDigit={typeDigit}
                    onClear={clearActive}
                    onBackspace={backspace}
                  />
                </div>
              )}
            </div>

            {/* Confirmación */}
            <div className="space-y-2 border-t bg-card p-4">
              {method === "cash" && cashValue < dueCents && (
                <p className="text-center text-xs font-medium text-warning-text">
                  Ingresa el monto recibido para calcular el cambio
                </p>
              )}
              {method === "mixed" && mixedRemaining !== 0 && (
                <p className="text-center text-xs font-medium text-warning-text">
                  Efectivo + tarjeta deben sumar {formatMoney(dueCents)}
                </p>
              )}
              <Button
                size="lg"
                className="h-14 w-full text-base"
                disabled={!valid || confirming}
                onClick={() => void confirm()}
              >
                {confirming ? "Procesando…" : `Cobrar ${formatMoney(dueCents)}`}
              </Button>
            </div>
          </>
        ) : (
          /* Recibo */
          <>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold leading-tight">Recibo</h2>
                <p className="text-xs text-success-text">
                  Pago registrado{method === "cash" && changeCents > 0 ? ` · cambio ${formatMoney(changeCents)}` : ""}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={onClose}
                className="flex size-10 items-center justify-center rounded-lg border hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="rounded-xl border bg-muted/40 p-3">
                <pre className="overflow-x-auto whitespace-pre font-mono text-[11px] leading-4 text-foreground">
                  {receiptLines.join("\n")}
                </pre>
              </div>
            </div>
            <div className="space-y-2 border-t bg-card p-4">
              <Button size="lg" className="h-12 w-full" disabled={printing} onClick={() => void handlePrint()}>
                <Printer className="size-5" />
                {printing ? "Imprimiendo…" : printSent ? "Reimprimir" : "Imprimir"}
              </Button>
              {printSent && (
                <p className="text-center text-xs text-success-text">Ticket enviado a la impresora ✔</p>
              )}
              {printError && <p className="text-center text-xs text-warning-text">{printError}</p>}
              {!printSent && !printError && (
                <p className="text-center text-xs text-muted-foreground">
                  {thermalPrinter.getState().status === "connected"
                    ? `Destino: ${thermalPrinter.getState().name ?? "impresora"}`
                    : "Sin impresora: el ticket irá a la cola"}
                </p>
              )}
              <Button size="lg" variant="outline" className="h-12 w-full" onClick={onClose}>
                Listo
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
