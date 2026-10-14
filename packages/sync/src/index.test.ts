/**
 * Tests del motor offline (docs/03-arquitectura.md §Arquitectura offline-first):
 * outbox idempotente, backoff, LWW y detección de conflictos.
 * Corren con MemoryOutboxStore — la persistencia (Dexie) es un detalle de device.
 */
import { describe, expect, it, vi } from "vitest";
import {
  AcceptingTransport,
  computeBackoffMs,
  detectConflict,
  HttpSyncTransport,
  lastWriteWins,
  MemoryOutboxStore,
  SyncEngine,
  uuidv7,
  type SyncTransport,
} from "./index";

function failingTransport(error = "network down"): SyncTransport {
  return { push: vi.fn().mockRejectedValue(new Error(error)) };
}

describe("uuidv7", () => {
  it("es un UUID v7 válido (versión y variante RFC 4122)", () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("ordena lexicográficamente por tiempo (FIFO natural)", async () => {
    let clock = 1_000;
    const a = uuidv7(() => clock);
    clock = 2_000;
    const b = uuidv7(() => clock);
    expect(a < b).toBe(true);
  });
});

describe("SyncEngine con transporte aceptante", () => {
  it("encola, sincroniza y devuelve el folio definitivo", async () => {
    const engine = new SyncEngine(new MemoryOutboxStore(), new AcceptingTransport());
    const event = await engine.enqueue("order.create", { totalCents: 2500 }, 1);
    const result = await engine.sync();

    expect(result.pushed).toBe(1);
    expect(result.synced).toContain(event.clientUuid);
    expect(result.numbers[event.clientUuid]).toBeGreaterThan(500);
  });

  it("es idempotente: un segundo sync no re-empuja nada", async () => {
    const store = new MemoryOutboxStore();
    const engine = new SyncEngine(store, new AcceptingTransport());
    await engine.enqueue("order.create", { totalCents: 2500 });
    await engine.sync();

    const second = await engine.sync();
    expect(second.pushed).toBe(0);
    expect(await store.countPending()).toBe(0);
  });

  it("respeta el orden FIFO del outbox", async () => {
    const store = new MemoryOutboxStore();
    const engine = new SyncEngine(store, new AcceptingTransport());
    const a = await engine.enqueue("order.create", { n: 1 });
    const b = await engine.enqueue("order.create", { n: 2 });
    const pending = await store.listPending();
    expect(pending.map((e) => e.clientUuid)).toEqual([a.clientUuid, b.clientUuid]);
  });
});

describe("SyncEngine ante fallas de red", () => {
  it("marca intento, mantiene pending y a maxAttempts pasa a failed", async () => {
    const store = new MemoryOutboxStore();
    const engine = new SyncEngine(store, failingTransport(), { maxAttempts: 2 });

    const event = await engine.enqueue("order.create", {});
    await engine.sync();
    expect((await store.listPending()).map((e) => e.clientUuid)).toEqual([event.clientUuid]);

    await engine.sync();
    const all = await store.listAll();
    expect(all.find((e) => e.clientUuid === event.clientUuid)?.status).toBe("failed");
  });

  it("el backoff exponencial crece y tiene tope", () => {
    expect(computeBackoffMs(1, 1000)).toBe(1000);
    expect(computeBackoffMs(2, 1000)).toBe(2000);
    expect(computeBackoffMs(3, 1000)).toBe(4000);
    expect(computeBackoffMs(20, 1000, 60_000)).toBe(60_000);
  });
});

describe("HttpSyncTransport", () => {
  it("envía eventos y parsea los acks", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ acks: [{ clientUuid: "u1", ok: true, definitiveNumber: 501 }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const transport = new HttpSyncTransport("http://localhost:3000/api/sync", {
        "X-Org-Slug": "cevicheria-el-muelle",
      });
      const acks = await transport.push([
        { clientUuid: "u1", type: "order.create", payload: {}, createdAt: new Date().toISOString(), attempts: 0, status: "pending" },
      ]);
      expect(acks).toEqual([{ clientUuid: "u1", ok: true, definitiveNumber: 501 }]);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3000/api/sync",
        expect.objectContaining({ method: "POST" }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("lanza en respuestas no-OK (el engine cuenta el intento)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 500 })));
    try {
      const transport = new HttpSyncTransport("http://localhost:3000/api/sync");
      await expect(transport.push([])).rejects.toThrow(/500/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("Conflictos (LWW)", () => {
  it("gana la escritura más reciente; empate gana servidor", () => {
    const base = { value: 1, updatedAt: "2026-01-01T00:00:00Z" };
    const local = { value: 2, updatedAt: "2026-01-02T00:00:00Z" };
    const server = { value: 3, updatedAt: "2026-01-03T00:00:00Z" };
    expect(lastWriteWins(local, server).value).toBe(3);

    const serverOld = { value: 4, updatedAt: "2026-01-01T00:00:00Z" };
    expect(lastWriteWins(local, serverOld).value).toBe(2);

    const tie = { value: 5, updatedAt: local.updatedAt };
    expect(lastWriteWins(local, tie).value).toBe(5);
  });

  it("detecta divergencia real: ambas partes cambiaron distinto", () => {
    const eq = (a: number, b: number) => a === b;
    const base = { value: 1, updatedAt: "t0" };
    expect(detectConflict(base, { value: 2, updatedAt: "t1" }, { value: 1, updatedAt: "t2" }, eq)).toBe(false);
    expect(detectConflict(base, { value: 2, updatedAt: "t1" }, { value: 3, updatedAt: "t2" }, eq)).toBe(true);
  });
});
