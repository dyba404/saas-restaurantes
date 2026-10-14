"use client";

import { useState } from "react";
import { CircleHelp, X } from "lucide-react";

const SECTIONS: Array<{ t: string; items: string[] }> = [
  {
    t: "Las 4 columnas",
    items: [
      "NUEVAS: comandas recién enviadas (POS, carta QR, WhatsApp, delivery).",
      "PREPARANDO: lo que la cocina está haciendo ahora.",
      "LISTAS: listas para servir/recoger.",
      "SERVIDAS: historial del día (conteo del turno).",
    ],
  },
  {
    t: "Avanzar una comanda",
    items: [
      "Un toque en el botón grande mueve la tarjeta a la siguiente columna (COCINAR → LISTA → SERVIDA).",
      "El avance es optimista: se registra aunque la red falle y se reconcilia solo.",
      "Cada tarjeta muestra folio, canal (POS/QR/WhatsApp/Glovo…), mesa, ítems y notas (ej. «sin cebolla»).",
    ],
  },
  {
    t: "SLA y alertas",
    items: [
      "El tiempo corre desde que entró la orden: ≥10 minutos la tarjeta se pone EN ROJO.",
      "Las notas de riesgo (⚠️) se muestran destacadas bajo el ítem.",
    ],
  },
  {
    t: "Conexión",
    items: [
      "«en vivo»: recibe las comandas AL INSTANTE por push (SSE).",
      "Si el push cae, entra un refresco de respaldo cada 15 s — no se pierde nada.",
      "«demo offline»: sin red, muestra el tablero de práctica con tus avances locales.",
      "Bip sonoro al entrar una comanda nueva (puedes silenciarlo arriba a la derecha).",
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
        className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        <CircleHelp className="mr-1 inline size-4 text-primary" /> ayuda
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">¿Cómo funciona la cocina?</h2>
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
