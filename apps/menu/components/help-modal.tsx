"use client";

import { useState } from "react";
import { CircleHelp, X } from "lucide-react";

const SECTIONS: Array<{ t: string; items: string[] }> = [
  {
    t: "Cómo pedir",
    items: [
      "Toca un producto para ver su detalle y agrégalo (los que tienen opciones te preguntan «¿Cómo lo quieres?»).",
      "Cada producto en tu carrito acepta una NOTA (ej. «ají aparte») — llega directo a cocina.",
      "La barra naranja de abajo muestra tu total; «Pedir» envía la comanda a la cocina del restaurante.",
    ],
  },
  {
    t: "Después de pedir",
    items: [
      "Verás tu número de pedido confirmado. La cocina lo recibe al instante.",
      "Si no hay internet, el pedido queda guardado y se envía solo al reconectar.",
    ],
  },
  {
    t: "Reservar mesa",
    items: [
      "Botón «Reservar mesa» arriba: elige día, hora y personas. El restaurante confirma tu reserva.",
    ],
  },
  {
    t: "Primera vez",
    items: [
      "Si el restaurante pide activación, la carta pedirá pegar un TOKEN una sola vez (te lo da el administrador).",
    ],
  },
];

export function HelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Ayuda"
        onClick={() => setOpen(true)}
        className="rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-muted"
      >
        <CircleHelp className="mr-1 inline size-3.5 text-primary" /> ayuda
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="max-h-[86dvh] w-full max-w-md overflow-y-auto rounded-2xl border bg-card p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">¿Cómo pedir?</h2>
              <button
                type="button"
                aria-label="Cerrar ayuda"
                onClick={() => setOpen(false)}
                className="rounded-lg border p-1.5 hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-4">
              {SECTIONS.map((s) => (
                <section key={s.t}>
                  <h3 className="text-sm font-bold text-primary">{s.t}</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {s.items.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
