/**
 * Outbox persistente en IndexedDB vía Dexie — reemplazo de LocalStorageOutboxStore (F1).
 *
 * ¿Por qué IndexedDB y no localStorage?
 * - Cuota: ~5MB de localStorage contra cientos de MB de IndexedDB (una tablet con
 *   un día de órdenes y payloads grandes no debe quedarse sin espacio).
 * - localStorage es síncrono y bloquea el hilo de UI con la cola creciente.
 *
 * La migración desde localStorage es automática, una sola vez y sin duplicar
 * eventos (la tabla usa clientUuid como llave primaria: put() es upsert).
 * UUID v7 ordena lexicográficamente por tiempo → la llave primaria ES el orden FIFO.
 */
import Dexie, { type Table } from "dexie";
import { LocalStorageOutboxStore, MemoryOutboxStore, type OutboxEvent, type OutboxStore } from "./index";

class OutboxDexie extends Dexie {
  /** Llave primaria clientUuid; índices para pending y orden temporal. */
  events!: Table<OutboxEvent, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      events: "clientUuid, status, createdAt",
    });
  }
}

export class DexieOutboxStore implements OutboxStore {
  private db: OutboxDexie;

  constructor(dbName = "rest.outbox") {
    // Lanza de forma síncrona si indexedDB no existe (SSR/tests) — la fábrica
    // degrada a LocalStorage/Memory antes de llegar aquí.
    this.db = new OutboxDexie(dbName);
    void this.migrateFromLocalStorage();
  }

  /**
   * Copia one-time los eventos legacy de localStorage y limpia la clave.
   * Idempotente (flag en localStorage) y tolerante a storage bloqueado.
   */
  private async migrateFromLocalStorage(): Promise<void> {
    if (typeof window === "undefined") return;
    const MIGRATED = "rest.outbox.migrated";
    try {
      if (window.localStorage.getItem(MIGRATED)) return;
      const raw = window.localStorage.getItem("rest.outbox");
      if (raw) {
        const legacy = JSON.parse(raw) as OutboxEvent[];
        if (Array.isArray(legacy) && legacy.length > 0) {
          await this.db.events.bulkPut(legacy);
        }
        window.localStorage.removeItem("rest.outbox");
      }
      window.localStorage.setItem(MIGRATED, "1");
    } catch {
      // Storage bloqueado (Safari privado) o DB no abierta: la migración se
      // reintenta en la próxima sesión; el flujo normal nunca depende de ella.
    }
  }

  async add(event: OutboxEvent): Promise<void> {
    await this.db.events.put(event);
  }

  async listPending(): Promise<OutboxEvent[]> {
    const pending = await this.db.events.where("status").equals("pending").toArray();
    return pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listAll(): Promise<OutboxEvent[]> {
    const all = await this.db.events.toArray();
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async update(event: OutboxEvent): Promise<void> {
    await this.db.events.put(event);
  }

  async countPending(): Promise<number> {
    return this.db.events.where("status").equals("pending").count();
  }
}

/**
 * Store por defecto para las apps: Dexie/IndexedDB donde exista, localStorage
 * como fallback de navegador viejo y memoria en SSR/tests.
 */
export function createDefaultOutboxStore(dbName = "rest.outbox"): OutboxStore {
  if (typeof window === "undefined") return new MemoryOutboxStore();
  if (!("indexedDB" in window)) return new LocalStorageOutboxStore(dbName);
  try {
    return new DexieOutboxStore(dbName);
  } catch {
    return new LocalStorageOutboxStore(dbName);
  }
}
