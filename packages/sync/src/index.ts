/**
 * Motor offline-first — docs/03-arquitectura.md §Arquitectura offline-first.
 *
 * Patrón outbox + idempotencia:
 *  1. Toda mutación del POS/KDS se encola como OutboxEvent con clientUuid (UUID v7).
 *  2. sync() empuja los eventos pendientes en orden; el servidor deduplica por
 *     clientUuid (unique index) — los reintentos nunca duplican una orden.
 *  3. El servidor es la verdad para folios: la orden lleva provisionalNumber
 *     local y recibe `number` definitivo al sincronizar.
 *
 * Este package es puro (sin deps) para correr igual en dispositivo y en tests.
 */

// ── Eventos ─────────────────────────────────────────────────────────────────

export type OutboxEventStatus = "pending" | "synced" | "failed";

export interface OutboxEvent<TPayload = unknown> {
  /** UUID v7 generado en el dispositivo. La llave de idempotencia. */
  clientUuid: string;
  /** Ej: "order.create" | "order.pay" | "catalog.mark86" */
  type: string;
  payload: TPayload;
  /** Hora del dispositivo (ISO). El servidor usa su propia hora para métricas. */
  createdAt: string;
  attempts: number;
  status: OutboxEventStatus;
  lastError?: string;
  /** Folio provisional local (solo órdenes). */
  provisionalNumber?: number;
}

/** UUID v7 (timestamp-ordenable) sin dependencias. */
export function uuidv7(now: () => number = Date.now): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const ts = now(); // ms
  // 48 bits de timestamp en los 6 primeros bytes (big-endian)
  bytes[0] = (ts / 2 ** 40) & 0xff;
  bytes[1] = (ts / 2 ** 32) & 0xff;
  bytes[2] = (ts / 2 ** 24) & 0xff;
  bytes[3] = (ts / 2 ** 16) & 0xff;
  bytes[4] = (ts / 2 ** 8) & 0xff;
  bytes[5] = ts & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // versión 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ── Store (persistencia local: IndexedDB/Dexie en dispositivo, memoria en tests) ──

export interface OutboxStore {
  add(event: OutboxEvent): Promise<void>;
  /** Eventos pendientes en orden de creación (el orden de mutaciones importa). */
  listPending(): Promise<OutboxEvent[]>;
  listAll(): Promise<OutboxEvent[]>;
  update(event: OutboxEvent): Promise<void>;
  countPending(): Promise<number>;
}

export class MemoryOutboxStore implements OutboxStore {
  private events: OutboxEvent[] = [];

  async add(event: OutboxEvent): Promise<void> {
    this.events.push(event);
  }
  async listPending(): Promise<OutboxEvent[]> {
    return this.events
      .filter((e) => e.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async listAll(): Promise<OutboxEvent[]> {
    return [...this.events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async update(event: OutboxEvent): Promise<void> {
    this.events = this.events.map((e) => (e.clientUuid === event.clientUuid ? event : e));
  }
  async countPending(): Promise<number> {
    return this.events.filter((e) => e.status === "pending").length;
  }
}

// ── Transporte (el servidor responde con los folios definitivos) ────────────

export interface SyncAck {
  clientUuid: string;
  ok: boolean;
  /** Folio definitivo asignado por el servidor (órdenes). */
  definitiveNumber?: number;
  error?: string;
}

export interface SyncTransport {
  /** POST /sync — el servidor aplica en transacción y deduplica por clientUuid. */
  push(events: OutboxEvent[]): Promise<SyncAck[]>;
}

/** Transporte de prueba: acepta todo y simula el servidor. */
export class AcceptingTransport implements SyncTransport {
  private counter = 500;
  async push(events: OutboxEvent[]): Promise<SyncAck[]> {
    return events.map((e) => ({
      clientUuid: e.clientUuid,
      ok: true,
      definitiveNumber: e.type === "order.create" ? ++this.counter : undefined,
    }));
  }
}

/**
 * Transporte HTTP real contra POST /api/sync (web-admin).
 * Espera acks por evento con el folio definitivo para órdenes.
 */
export class HttpSyncTransport implements SyncTransport {
  constructor(
    private readonly url: string,
    private readonly headers: Record<string, string> = {},
  ) {}
  async push(events: OutboxEvent[]): Promise<SyncAck[]> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers },
      body: JSON.stringify({ events }),
    });
    if (!response.ok) {
      throw new Error(`sync HTTP ${response.status}`);
    }
    const data = (await response.json()) as { acks: SyncAck[] };
    return data.acks;
  }
}

// ── Store persistente (navegador) ───────────────────────────────────────────

/**
 * Outbox en localStorage — sobrevive recargas y cierres de la tablet.
 * Misma interfaz que MemoryOutboxStore; en F1 migrará a IndexedDB (Dexie)
 * sin cambiar SyncEngine.
 */
export class LocalStorageOutboxStore implements OutboxStore {
  constructor(private readonly key = "rest.outbox") {}

  private read(): OutboxEvent[] {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem(this.key) ?? "[]") as OutboxEvent[];
    } catch {
      return [];
    }
  }

  private write(events: OutboxEvent[]): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(this.key, JSON.stringify(events));
  }

  async add(event: OutboxEvent): Promise<void> {
    this.write([...this.read(), event]);
  }
  async listPending(): Promise<OutboxEvent[]> {
    return this.read()
      .filter((e) => e.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async listAll(): Promise<OutboxEvent[]> {
    return this.read().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async update(event: OutboxEvent): Promise<void> {
    this.write(this.read().map((e) => (e.clientUuid === event.clientUuid ? event : e)));
  }
  async countPending(): Promise<number> {
    return this.read().filter((e) => e.status === "pending").length;
  }
}

// ── Backoff ─────────────────────────────────────────────────────────────────

/** Exponencial con tope: base * 2^(attempts-1), máx. maxDelayMs. */
export function computeBackoffMs(attempts: number, baseMs = 1000, maxDelayMs = 60_000): number {
  return Math.min(baseMs * 2 ** Math.max(0, attempts - 1), maxDelayMs);
}

// ── Engine ──────────────────────────────────────────────────────────────────

export interface SyncResult {
  pushed: number;
  synced: string[];
  failed: string[];
  /** Órdenes con folio definitivo ya asignado: {clientUuid → number}. */
  numbers: Record<string, number>;
}

export interface SyncEngineOptions {
  batchSize?: number;
  maxAttempts?: number;
}

export class SyncEngine {
  constructor(
    private readonly store: OutboxStore,
    private readonly transport: SyncTransport,
    private readonly options: SyncEngineOptions = {},
  ) {}

  /** Encola una mutación. Se llama SIEMPRE, haya red o no. */
  async enqueue<T>(type: string, payload: T, provisionalNumber?: number): Promise<OutboxEvent<T>> {
    const event: OutboxEvent<T> = {
      clientUuid: uuidv7(),
      type,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: "pending",
      provisionalNumber,
    };
    await this.store.add(event);
    return event;
  }

  /** Intenta vaciar la cola. Idempotente: seguro llamarlo en cada reconexión. */
  async sync(): Promise<SyncResult> {
    const batchSize = this.options.batchSize ?? 20;
    const maxAttempts = this.options.maxAttempts ?? 8;
    const result: SyncResult = { pushed: 0, synced: [], failed: [], numbers: {} };

    let pending = await this.store.listPending();
    while (pending.length > 0) {
      const batch = pending.slice(0, batchSize);
      try {
        const acks = await this.transport.push(batch);
        for (const ack of acks) {
          const event = batch.find((e) => e.clientUuid === ack.clientUuid);
          if (!event) continue;
          if (ack.ok) {
            event.status = "synced";
            event.lastError = undefined;
            result.synced.push(ack.clientUuid);
            if (ack.definitiveNumber != null) {
              result.numbers[ack.clientUuid] = ack.definitiveNumber;
            }
          } else {
            event.attempts += 1;
            event.lastError = ack.error;
            event.status = event.attempts >= maxAttempts ? "failed" : "pending";
            if (event.status === "failed") result.failed.push(event.clientUuid);
          }
          await this.store.update(event);
        }
        result.pushed += batch.length;
      } catch (error) {
        // Red caída: marcar intento, mantener pending, salir (sync() se reinvoca al reconectar).
        for (const event of batch) {
          event.attempts += 1;
          event.lastError = error instanceof Error ? error.message : String(error);
          event.status = event.attempts >= maxAttempts ? "failed" : "pending";
          await this.store.update(event);
          if (event.status === "failed") result.failed.push(event.clientUuid);
        }
        break;
      }
      pending = await this.store.listPending();
    }
    return result;
  }
}

// ── Conflictos (regla del 99%: LWW por campo en entidades de catálogo) ──────

export interface Versioned<T> {
  value: T;
  updatedAt: string;
}

/** Última escritura gana por timestamp; empate → gana el servidor (isServer). */
export function lastWriteWins<T>(local: Versioned<T>, server: Versioned<T>): Versioned<T> {
  if (server.updatedAt >= local.updatedAt) return server;
  return local;
}

/**
 * Detector de divergencia para el caso raro (misma entidad editada en dos
 * tablets offline): si ambas versiones cambiaron desde la base común, la orden
 * se marca para revisión del gerente — nunca se fusiona en silencio.
 * Ver docs/03-arquitectura.md.
 */
export function detectConflict<T>(
  base: Versioned<T>,
  a: Versioned<T>,
  b: Versioned<T>,
  isEqual: (x: T, y: T) => boolean,
): boolean {
  const aChanged = !isEqual(a.value, base.value);
  const bChanged = !isEqual(b.value, base.value);
  return aChanged && bChanged && !isEqual(a.value, b.value);
}

// Store Dexie/IndexedDB (F1) + fábrica por defecto para las apps.
export { DexieOutboxStore, createDefaultOutboxStore } from "./dexie-store";
