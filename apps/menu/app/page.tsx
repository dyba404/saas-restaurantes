"use client";

import { CheckCircle2, Loader2, Minus, Plus, RotateCw, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Badge, Button, cn } from "@rest/ui";
import { createDefaultOutboxStore, HttpSyncTransport, SyncEngine } from "@rest/sync";
import type { Category, Product } from "@rest/types";
import { API_BASE, ORG_HEADERS, fetchWithTimeout } from "@/lib/api";
import { HelpButton } from "@/components/help-modal";;
import { categories as demoCategories, money, products as demoProducts } from "@/lib/menu";

// ── Tipos del catálogo (bootstrap) ──────────────────────────────────────────

type CartaProduct = Product & { description: string; gradient: string };

interface Catalog {
  name: string;
  categories: Category[];
  products: CartaProduct[];
  source: "live" | "demo";
}

const DEMO_CATALOG: Catalog = {
  name: "Cevichería El Muelle",
  categories: demoCategories,
  products: demoProducts,
  source: "demo",
};

interface BootstrapCategory {
  id: string;
  name: string;
  sortOrder: number;
}

interface BootstrapProduct {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  priceCents: number;
  available: boolean;
}

interface BootstrapResponse {
  organization?: { name?: string };
  categories?: BootstrapCategory[];
  products?: BootstrapProduct[];
}

/** Gradiente determinista por producto (el API no manda imagen). */
const GRADIENTS = [
  "from-orange-300 to-red-400",
  "from-amber-300 to-orange-400",
  "from-yellow-300 to-amber-400",
  "from-red-300 to-rose-400",
  "from-lime-300 to-green-500",
  "from-stone-200 to-amber-100",
  "from-zinc-400 to-zinc-600",
  "from-orange-200 to-amber-400",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length]!;
}

function toCartaProduct(p: BootstrapProduct): CartaProduct {
  return {
    id: p.id,
    categoryId: p.categoryId,
    name: p.name,
    description: p.description ?? "",
    priceCents: p.priceCents,
    active: true,
    available: p.available !== false,
    modifierGroups: [],
    gradient: gradientFor(p.id),
  };
}

// ── Estado del pedido (outbox offline-first) ────────────────────────────────

type OrderState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "queued"; provisional?: number }
  | { status: "confirmed"; folio: number };

interface OrderItemPayload {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  modifierNames: string[];
  /** Nota libre del comensal (ej. "ají aparte") — llega a cocina y al ticket. */
  notes?: string;
}

interface OrderCreatePayload {
  channel: "qr";
  table: string;
  items: OrderItemPayload[];
  totalCents: number;
  provisionalNumber: number;
}

export default function CartaPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg p-6 text-sm text-muted-foreground">Cargando carta…</div>
      }
    >
      <CartaView />
    </Suspense>
  );
}

function CartaView() {
  const searchParams = useSearchParams();
  const mesa = searchParams.get("mesa") ?? "Mesa 7";

  const [catalog, setCatalog] = useState<Catalog>(DEMO_CATALOG);
  const [activeCategory, setActiveCategory] = useState(demoCategories[0]?.id ?? "");
  const [cart, setCart] = useState<Record<string, number>>({});
  /** Nota libre por producto del carrito (el API de sync ya la soporta por ítem). */
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [orderState, setOrderState] = useState<OrderState>({ status: "idle" });

  const engineRef = useRef<SyncEngine | null>(null);
  const provisionalRef = useRef(0);

  // Bootstrap (timeout 2.5 s): catálogo en vivo; si falla, sigue el demo local.
  useEffect(() => {
    let cancelled = false;
    fetchWithTimeout(`${API_BASE}/api/bootstrap`, { headers: ORG_HEADERS })
      .then(async (res) => {
        if (!res.ok) throw new Error(`bootstrap HTTP ${res.status}`);
        return (await res.json()) as BootstrapResponse;
      })
      .then((data) => {
        if (cancelled) return;
        const cats = (data.categories ?? [])
          .map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder, active: true }))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const prods = (data.products ?? [])
          .filter((p) => p.available !== false)
          .map(toCartaProduct);
        if (cats.length === 0 || prods.length === 0) return; // catálogo vacío → mejor demo
        setCatalog({
          name: data.organization?.name ?? DEMO_CATALOG.name,
          categories: cats,
          products: prods,
          source: "live",
        });
      })
      .catch(() => {
        // Sin red / timeout: la carta demo ya está pintada (offline-first).
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Si el catálogo en vivo trae otras categorías, reposiciónate a la primera.
  useEffect(() => {
    if (
      catalog.categories.length > 0 &&
      !catalog.categories.some((c) => c.id === activeCategory)
    ) {
      setActiveCategory(catalog.categories[0]!.id);
    }
  }, [catalog, activeCategory]);

  /** SyncEngine perezoso (solo en interacciones del cliente, nunca en SSR). */
  function getEngine(): SyncEngine {
    if (!engineRef.current) {
      engineRef.current = new SyncEngine(
        createDefaultOutboxStore("rest.menu.outbox"),
        new HttpSyncTransport(`${API_BASE}/api/sync`, ORG_HEADERS),
      );
    }
    return engineRef.current;
  }

  /** Consume acks: folio definitivo → confirmado; fallo → queda en cola. */
  async function runSync(clientUuid: string, provisional?: number): Promise<void> {
    try {
      const result = await getEngine().sync();
      const folio = result.numbers[clientUuid];
      setOrderState(
        folio != null ? { status: "confirmed", folio } : { status: "queued", provisional },
      );
    } catch {
      setOrderState({ status: "queued", provisional });
    }
  }

  async function placeOrder(): Promise<void> {
    if (orderState.status === "sending") return;
    const entries = Object.entries(cart).filter(([, qty]) => qty > 0);
    if (entries.length === 0) return;

    const items: OrderItemPayload[] = entries.map(([id, quantity]) => {
      const product = catalog.products.find((p) => p.id === id);
      const note = notes[id]?.trim();
      return {
        productId: id,
        name: product?.name ?? id,
        quantity,
        unitPriceCents: product?.priceCents ?? 0,
        modifierNames: [],
        notes: note ? note : undefined,
      };
    });
    const totalCents = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);

    provisionalRef.current += 1;
    const provisional = provisionalRef.current;
    const payload: OrderCreatePayload = {
      channel: "qr",
      table: mesa,
      items,
      totalCents,
      provisionalNumber: provisional,
    };

    setOrderState({ status: "sending" });
    try {
      const event = await getEngine().enqueue<OrderCreatePayload>(
        "order.create",
        payload,
        provisional,
      );
      // La cola ya persistió el evento en Dexie: entrega garantizada.
      setCart({});
      setNotes({});
      await runSync(event.clientUuid, provisional);
    } catch {
      setOrderState({ status: "queued", provisional });
    }
  }

  async function retrySync(): Promise<void> {
    const previous =
      orderState.status === "queued" ? orderState.provisional : provisionalRef.current;
    setOrderState({ status: "sending" });
    try {
      const result = await getEngine().sync();
      const folios = Object.values(result.numbers);
      setOrderState(
        folios.length > 0
          ? { status: "confirmed", folio: Math.max(...folios) }
          : { status: "queued", provisional: previous },
      );
    } catch {
      setOrderState({ status: "queued", provisional: previous });
    }
  }

  function setQty(id: string, delta: number): void {
    setCart((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
    if (orderState.status === "confirmed") setOrderState({ status: "idle" });
  }

  const visible = catalog.products.filter((p) => p.categoryId === activeCategory);
  const cartEntries = Object.entries(cart).filter(([, qty]) => qty > 0);
  const itemCount = cartEntries.reduce((sum, [, qty]) => sum + qty, 0);
  const totalCents = cartEntries.reduce((sum, [id, qty]) => {
    const product = catalog.products.find((p) => p.id === id);
    return sum + (product ? product.priceCents * qty : 0);
  }, 0);

  return (
    <div className="mx-auto max-w-lg">
      {/* Encabezado de la carta */}
      <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">{catalog.name}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  catalog.source === "live" ? "bg-success" : "bg-warning",
                )}
                aria-hidden
              />
              {mesa} · {catalog.source === "live" ? "en vivo" : "demo"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success">Abierto</Badge>
            <Link
              href="/reservas"
              className="rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-muted"
            >
              Reservar mesa
            </Link>
            <span className="rounded-full border px-2 py-0.5 text-xs font-medium">es ▾</span>
            <HelpButton />
          </div>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {catalog.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                activeCategory === c.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </header>

      {/* Productos */}
      <main className="space-y-3 px-4 py-4">
        {visible.map((p) => {
          const qty = cart[p.id] ?? 0;
          return (
            <article key={p.id} className="flex gap-3 rounded-xl border bg-card p-3">
              <div className={cn("size-20 shrink-0 rounded-lg bg-gradient-to-br", p.gradient)} aria-hidden />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold leading-tight">{p.name}</h2>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-bold text-primary">{money(p.priceCents)}</span>
                  {qty === 0 ? (
                    <Button size="sm" onClick={() => setQty(p.id, 1)}>
                      <Plus className="size-4" /> Agregar
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Quitar uno"
                        onClick={() => setQty(p.id, -1)}
                        className="flex size-9 items-center justify-center rounded-full border"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="w-5 text-center font-bold tabular-nums">{qty}</span>
                      <button
                        type="button"
                        aria-label="Agregar uno"
                        onClick={() => setQty(p.id, 1)}
                        className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
                {qty > 0 && (
                  <input
                    value={notes[p.id] ?? ""}
                    onChange={(event) =>
                      setNotes((prev) => ({ ...prev, [p.id]: event.target.value }))
                    }
                    placeholder="¿Alguna indicación? (ej. ají aparte, sin cebolla)"
                    aria-label={`Nota para ${p.name}`}
                    maxLength={120}
                    className="mt-2 h-9 w-full rounded-lg border bg-background px-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                )}
              </div>
            </article>
          );
        })}

        {orderState.status === "confirmed" && (
          <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-center">
            <p className="flex items-center justify-center gap-2 font-semibold text-success-text">
              <CheckCircle2 className="size-5" />
              ¡Pedido #{orderState.folio} confirmado en cocina! 🎉
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tu comanda ya está en la pantalla de cocina.
            </p>
          </div>
        )}

        {orderState.status === "sending" && (
          <div className="rounded-xl border border-warning/20 bg-warning/10 p-4 text-center">
            <p className="flex items-center justify-center gap-2 font-semibold text-warning-text">
              <Loader2 className="size-4 animate-spin" />
              Enviando pedido a cocina…
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tu pedido quedó en cola y se enviará solo al reconectar.
            </p>
          </div>
        )}

        {orderState.status === "queued" && (
          <div className="rounded-xl border border-warning/20 bg-warning/10 p-4 text-center">
            <p className="font-semibold text-warning-text">Enviando pedido a cocina…</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sin conexión por ahora: tu pedido quedó guardado y se reintenta automáticamente.
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void retrySync()}>
              <RotateCw className="size-4" /> Reintentar ahora
            </Button>
          </div>
        )}
      </main>

      {/* Barra de carrito flotante */}
      {itemCount > 0 && orderState.status !== "sending" && (
        <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-lg p-3">
          <Button
            className="h-14 w-full justify-between text-base"
            onClick={() => void placeOrder()}
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="size-5" />
              {itemCount} {itemCount === 1 ? "producto" : "productos"}
            </span>
            <span className="tabular-nums">{money(totalCents)} · Pedir ▸</span>
          </Button>
        </div>
      )}
    </div>
  );
}
