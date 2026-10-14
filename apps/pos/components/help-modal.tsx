"use client";

import { useState } from "react";
import { CircleHelp, X } from "lucide-react";

const SECTIONS: Array<{ t: string; items: string[] }> = [
  {
    t: "Vender (flujo diario)",
    items: [
      "Elige la mesa arriba a la derecha (o deja la barra si es para llevar).",
      "Toca las categorías y los productos: se agregan a la cuenta de la derecha.",
      "Si el producto pregunta «¿Cómo lo quieres?», elige al menos una opción (es lo que cocina verá).",
      "Cada ítem acepta una NOTA libre (ej. «sin ají») — también llega a cocina y al ticket.",
      "«Enviar a cocina» manda la comanda: verás el folio definitivo en el banner verde.",
    ],
  },
  {
    t: "Cobrar",
    items: [
      "Botón «Cobrar»: elige efectivo (teclado numérico calcula el cambio), tarjeta o mixto (divide la cuenta).",
      "Propina: 10% o 15% opcional antes de cobrar.",
      "Al confirmar verás el recibo en pantalla; con impresora conectada, «Imprimir» lo manda al papel.",
      "El descuento (0/5/10%) se aplica a toda la cuenta y pide confirmación.",
    ],
  },
  {
    t: "Órdenes y Caja",
    items: [
      "Órdenes: las abiertas locales y del servidor, con estado de sincronización (sin sincronizar = aún en la cola).",
      "Cobrar una orden pendiente desde «Órdenes» o desde «Caja».",
      "Caja: totales reales del día, arqueo (cuenta lo físico vs sistema) y corte de turno.",
    ],
  },
  {
    t: "Impresora térmica",
    items: [
      "Chip «Impresora» arriba: elige Bluetooth, USB o Serial → el navegador pide elegir el dispositivo.",
      "«Ticket de prueba» imprime una página de control.",
      "Sin impresora conectada, los tickets quedan en cola (contador en pantalla).",
      "Requiere Chrome/Edge y HTTPS (en producción ya lo tienes por el túnel).",
    ],
  },
  {
    t: "Sin internet",
    items: [
      "El toggle «Sin internet» simula la caída: todo sigue vendiendo.",
      "Las órdenes quedan en la cola local (IndexedDB) y se envían solas al reconectar.",
      "El contador «N sin sincronizar» muestra lo pendiente — nunca se pierde nada.",
    ],
  },
  {
    t: "Primera vez en esta tablet",
    items: [
      "Si el administrador activó la auth por dispositivo, te pedirá pegar el TOKEN una sola vez (lo genera en Superadmin → Restaurante → Dispositivos).",
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
        className="absolute bottom-20 right-3 z-30 flex size-11 items-center justify-center rounded-full border bg-card shadow-lg hover:border-primary lg:bottom-16"
      >
        <CircleHelp className="size-5 text-primary" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">¿Cómo se usa el POS?</h2>
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
