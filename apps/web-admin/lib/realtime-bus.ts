/**
 * Bus de realtime en memoria, por organización (docs/05-diseno-pwa.md).
 *
 * El KDS (y pronto POS/admin) escucha "orders.changed" por SSE en
 * GET /api/realtime y refresca al instante en vez de sondear. Singleton en
 * globalThis para sobrevivir al HMR de dev. En F4 podría migrar a Postgres
 * LISTEN/NOTIFY o Redis si el servidor pasa a múltiples instancias.
 */

export interface RealtimeEvent {
  type: "orders.changed";
  orgId: string;
  at: string;
}

type Listener = (event: RealtimeEvent) => void;

const g = globalThis as unknown as { __restRealtimeBus?: Map<string, Set<Listener>> };

function bus(): Map<string, Set<Listener>> {
  return (g.__restRealtimeBus ??= new Map());
}

/** Publica tras un commit exitoso de una mutación de órdenes. Fire-and-forget. */
export function publishOrdersChanged(orgId: string): void {
  const event: RealtimeEvent = { type: "orders.changed", orgId, at: new Date().toISOString() };
  const listeners = bus().get(orgId);
  if (!listeners) return;
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Un consumidor muerto nunca tira abajo la mutación que lo notificó.
    }
  }
}

/** Suscripción del handler SSE. Devuelve la desuscripción. */
export function subscribeOrdersChanged(orgId: string, listener: Listener): () => void {
  let listeners = bus().get(orgId);
  if (!listeners) {
    listeners = new Set();
    bus().set(orgId, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) bus().delete(orgId);
  };
}
