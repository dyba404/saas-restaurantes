"use client";

import { useEffect, useState } from "react";
import { Bluetooth, Check, Loader2, Plug, Printer, Usb, X } from "lucide-react";
import {
  thermalPrinter,
  transportsAvailable,
  type PrinterTransport,
  type ThermalPrinterState,
} from "@/lib/thermal-printer";
import type { PaperWidth } from "@rest/printer";

const TRANSPORT_ICONS: Record<PrinterTransport, typeof Bluetooth> = {
  bluetooth: Bluetooth,
  usb: Usb,
  serial: Plug,
};

/**
 * Selector y estado de impresora térmica. El botón "Conectar" dispara el
 * diálogo nativo del navegador (Web Bluetooth/USB/Serial) así que debe vivir
 * en un evento de clic: no lo llames en un useEffect.
 */
export function PrinterPicker({
  open,
  onClose,
  paper = "mm58",
}: {
  open: boolean;
  onClose: () => void;
  paper?: PaperWidth;
}) {
  const [state, setState] = useState<ThermalPrinterState>(thermalPrinter.getState());
  const [busy, setBusy] = useState<PrinterTransport | null>(null);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const transports = transportsAvailable();

  useEffect(() => thermalPrinter.subscribe(setState), []);
  useEffect(() => {
    if (open) void thermalPrinter.tryReconnect();
  }, [open]);

  if (!open) return null;

  async function handleConnect(transport: PrinterTransport) {
    setBusy(transport);
    setNotice(null);
    try {
      await thermalPrinter.connect(transport);
      setNotice("Impresora conectada ✔");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No se pudo conectar.");
    } finally {
      setBusy(null);
    }
  }

  async function handleTest() {
    setTesting(true);
    setNotice(null);
    try {
      await thermalPrinter.printTest(paper);
      setNotice("Ticket de prueba enviado ✔");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Fallo el ticket de prueba.");
    } finally {
      setTesting(false);
    }
  }

  async function handleForget() {
    await thermalPrinter.forget();
    setNotice("Impresora olvidada.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Printer className="h-5 w-5" /> Impresora térmica
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Estado actual */}
        <div className="mb-4 flex items-center gap-2 rounded-xl border bg-neutral-50 px-3 py-2 text-sm">
          <span
            className={
              "h-2.5 w-2.5 rounded-full " +
              (state.status === "connected"
                ? "bg-emerald-500"
                : state.status === "connecting"
                  ? "animate-pulse bg-amber-500"
                  : state.status === "error"
                    ? "bg-red-500"
                    : "bg-neutral-300")
            }
          />
          {state.status === "connected" ? (
            <span>
              Conectada · <strong>{state.name}</strong>
            </span>
          ) : state.status === "connecting" ? (
            <span>Conectando…</span>
          ) : state.status === "error" ? (
            <span className="text-red-600">{state.error}</span>
          ) : (
            <span>Sin impresora conectada</span>
          )}
        </div>

        {/* Transportes disponibles en este navegador */}
        <div className="space-y-2">
          {transports.map(({ kind, label, available, hint }) => {
            const Icon = TRANSPORT_ICONS[kind];
            const connecting = busy === kind || (state.status === "connecting" && state.transport === kind);
            return (
              <button
                key={kind}
                type="button"
                disabled={!available || busy !== null}
                onClick={() => void handleConnect(kind)}
                className="flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-neutral-500">
                    {available ? hint : "No disponible en este navegador (requiere HTTPS)"}
                  </span>
                </span>
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : state.status === "connected" && state.transport === kind ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <span className="text-xs text-neutral-400">Conectar</span>
                )}
              </button>
            );
          })}
        </div>

        {notice ? <p className="mt-3 text-sm text-neutral-600">{notice}</p> : null}

        {/* Acciones */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={state.status !== "connected" || testing}
            onClick={() => void handleTest()}
            className="flex-1 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {testing ? "Imprimiendo…" : "Ticket de prueba"}
          </button>
          <button
            type="button"
            disabled={state.status !== "connected"}
            onClick={() => void handleForget()}
            className="rounded-xl border px-4 py-2.5 text-sm font-medium disabled:opacity-40"
          >
            Olvidar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Chip compacto para el header del POS: abre el picker con un clic. */
export function PrinterStatusChip({ onOpen }: { onOpen: () => void }) {
  const [state, setState] = useState<ThermalPrinterState>(thermalPrinter.getState());
  useEffect(() => thermalPrinter.subscribe(setState), []);

  const label =
    state.status === "connected"
      ? (state.name ?? "Impresora")
      : state.status === "connecting"
        ? "Conectando…"
        : "Impresora";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
      title={state.error ?? "Configurar impresora térmica"}
    >
      <span
        className={
          "h-2 w-2 rounded-full " +
          (state.status === "connected"
            ? "bg-emerald-500"
            : state.status === "connecting"
              ? "animate-pulse bg-amber-500"
              : "bg-neutral-300")
        }
      />
      <Printer className="h-3.5 w-3.5" />
      <span className="max-w-28 truncate">{label}</span>
    </button>
  );
}
