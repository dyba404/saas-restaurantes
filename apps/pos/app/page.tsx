"use client";

/**
 * Shell del POS — motor de sync real (una sola instancia), bootstrap con
 * fallback offline, toggle "sin internet", navegación inferior de 3 pestañas
 * (Vender | Órdenes | Caja) y orquestación del flujo de cobro + impresión.
 */
import {
  Cloud,
  CloudOff,
  ClipboardList,
  Printer,
  RefreshCw,
  ShoppingCart,
  Wallet,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  createDefaultOutboxStore,
  HttpSyncTransport,
  SyncEngine,
  uuidv7,
} from "@rest/sync";
import { Badge, cn } from "@rest/ui";
import {
  orderItemTotalCents,
  orderTotalsCents,
  type OrderItem,
} from "@rest/types";
import {
  API_BASE,
  ORG_HEADERS,
  demoCatalog,
  fetchActiveOrders,
  fetchBootstrap,
  loadBootstrapCache,
  mapBootstrap,
  mockActiveOrders,
  type CatalogSnapshot,
  type CatalogSource,
  type RemoteOrder,
} from "@/lib/api";
import {
  cartReducer,
  cartUnitPriceCents,
  type CartItem,
  type LocalOrder,
  type PayableOrder,
  type PaymentConfirmation,
  type SessionPayment,
} from "@/lib/pos-types";
import { loadJson, saveJson, usePersistedState } from "@/lib/storage";
import { CashTab } from "@/components/cash-tab";
import { OrdersTab, type RemoteState } from "@/components/orders-tab";
import { PaymentSheet } from "@/components/payment-sheet";
import { PrinterPicker, PrinterStatusChip } from "@/components/printer-picker";
import { thermalPrinter } from "@/lib/thermal-printer";
import { HelpButton } from "@/components/help-modal";
import { SellTab } from "@/components/sell-tab";

const STAFF_NAME = "Ana";
const PROVISIONAL_START = 412;

type Tab = "sell" | "orders" | "cash";
type BannerKind = "success" | "warning" | "info";

interface Banner {
  kind: BannerKind;
  text: string;
}

const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "sell", label: "Vender", icon: ShoppingCart },
  { id: "orders", label: "Órdenes", icon: ClipboardList },
  { id: "cash", label: "Caja", icon: Wallet },
];

export default function PosPage() {
  // ── Motor de sync: UNA instancia por sesión, outbox persistente ───────────
  // Dexie/IndexedDB (con migración automática desde localStorage) o fallback.
  const outboxStore = useMemo(() => createDefaultOutboxStore("rest.pos.outbox"), []);
  const engine = useMemo(
    () => new SyncEngine(outboxStore, new HttpSyncTransport(`${API_BASE}/api/sync`, ORG_HEADERS)),
    [outboxStore],
  );

  // ── Estado global del shell ────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("sell");
  const [catalog, setCatalog] = useState<CatalogSnapshot>(() => demoCatalog());
  const [catalogSource, setCatalogSource] = useState<CatalogSource>("loading");
  const [offline, setOffline] = usePersistedState<boolean>("rest.pos.offline", false);
  const [pending, setPending] = useState(0);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [printQueue, setPrintQueue] = usePersistedState<number>("rest.pos.printQueue", 0);
  const [payments, setPayments] = usePersistedState<SessionPayment[]>("rest.pos.payments", []);
  const [localOrders, setLocalOrders] = usePersistedState<LocalOrder[]>("rest.pos.orders", []);
  const [chargedNumbers, setChargedNumbers] = usePersistedState<number[]>("rest.pos.charged", []);
  const [remoteOrders, setRemoteOrders] = useState<RemoteOrder[]>([]);
  const [remoteState, setRemoteState] = useState<RemoteState>("loading");
  const [checkout, setCheckout] = useState<PayableOrder | null>(null);

  // ── Carrito (reducer) + descuento + mesa ───────────────────────────────────
  const [cart, dispatchCart] = useReducer(cartReducer, [] as CartItem[]);
  const [discountPct, setDiscountPct] = useState(0);
  const [table, setTable] = useState("");
  const [sending, setSending] = useState(false);

  const totals = useMemo(() => {
    const items: OrderItem[] = cart.map((c) => ({
      id: c.key,
      productId: c.product.id,
      name: c.product.name,
      quantity: c.quantity,
      unitPriceCents: c.product.priceCents,
      modifiers: c.modifiers,
      totalCents: orderItemTotalCents({
        quantity: c.quantity,
        unitPriceCents: c.product.priceCents,
        modifiers: c.modifiers,
      }),
    }));
    const base = orderTotalsCents(items);
    const discountCents = Math.round((base.subtotalCents * discountPct) / 100);
    return orderTotalsCents(items, discountCents);
  }, [cart, discountPct]);

  const tables = catalog.tables.length > 0 ? catalog.tables : demoCatalog().tables;
  // La mesa persistida puede no existir tras un cambio de catálogo: se re-ancla.
  const effectiveTable = tables.some((t) => t.name === table)
    ? table
    : (tables[0]?.name ?? "Para llevar");

  // ── Folio provisional (persistente entre recargas) ────────────────────────
  const provisionalRef = useRef(PROVISIONAL_START);
  useEffect(() => {
    provisionalRef.current = loadJson<number>("rest.pos.provisional", PROVISIONAL_START);
  }, []);
  const takeProvisional = useCallback(() => {
    provisionalRef.current += 1;
    saveJson("rest.pos.provisional", provisionalRef.current);
    return provisionalRef.current;
  }, []);

  // ── Banners con auto-dismiss ───────────────────────────────────────────────
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showBanner = useCallback((kind: BannerKind, text: string, ms = 4_500) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner({ kind, text });
    bannerTimer.current = setTimeout(() => setBanner(null), ms);
  }, []);

  // ── Offline ref para callbacks async ───────────────────────────────────────
  const offlineRef = useRef(offline);
  useEffect(() => {
    offlineRef.current = offline;
  }, [offline]);

  const refreshPending = useCallback(async () => {
    try {
      setPending(await outboxStore.countPending());
    } catch {
      /* el badge se refresca en la siguiente operación */
    }
  }, [outboxStore]);

  // ── Sync real: vacía la cola y asigna folios definitivos ───────────────────
  const runSync = useCallback(
    async (silent = false) => {
      if (offlineRef.current) return;
      try {
        const result = await engine.sync();
        await refreshPending();
        const numbers = Object.keys(result.numbers);
        if (numbers.length > 0) {
          setLocalOrders((prev) =>
            prev.map((order) =>
              result.numbers[order.clientUuid] != null
                ? { ...order, number: result.numbers[order.clientUuid] }
                : order,
            ),
          );
        }
        if (silent) return;
        if (result.synced.length > 0) {
          showBanner(
            "success",
            `${result.synced.length} órdenes sincronizadas${
              numbers.length > 0 ? " · folios asignados" : ""
            }`,
          );
        } else if (result.failed.length > 0) {
          showBanner("warning", "Algunos eventos no se pudieron sincronizar — siguen en cola");
        } else {
          showBanner("info", "Sin eventos pendientes — todo sincronizado");
        }
      } catch {
        await refreshPending();
        if (!silent) showBanner("warning", "Sin conexión — los eventos quedaron en cola");
      }
    },
    [engine, refreshPending, setLocalOrders, showBanner],
  );

  // ── Bootstrap: red → caché → demo. Nunca bloquea la UI (timeout 2.5s) ─────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchBootstrap();
        if (cancelled) return;
        setCatalog(mapBootstrap(data));
        setCatalogSource("live");
      } catch {
        if (cancelled) return;
        const cached = loadBootstrapCache();
        if (cached) {
          setCatalog(mapBootstrap(cached));
          setCatalogSource("cache");
        } else {
          setCatalog(demoCatalog());
          setCatalogSource("demo");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Al montar: badge de pendientes + drenaje de la cola si hay red ────────
  useEffect(() => {
    void refreshPending();
    // Lee el flag persistido directo (el estado hidrata después del mount).
    const savedOffline = loadJson<boolean>("rest.pos.offline", false);
    if (!savedOffline) void runSync(true);
  }, [refreshPending, runSync]);

  // ── Órdenes remotas: primer fetch al entrar a la pestaña ──────────────────
  const remoteLoadedRef = useRef(false);
  useEffect(() => {
    if (tab === "orders" && !remoteLoadedRef.current) {
      remoteLoadedRef.current = true;
      void refreshRemote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function refreshRemote() {
    setRemoteState("loading");
    try {
      const data = await fetchActiveOrders();
      setRemoteOrders(data.orders);
      setRemoteState("live");
    } catch {
      setRemoteOrders(mockActiveOrders());
      setRemoteState("demo");
    }
  }

  // ── Enviar a cocina: SIEMPRE encola; sync solo si hay red ─────────────────
  async function sendToKitchen() {
    if (cart.length === 0 || sending) return;
    setSending(true);
    try {
      const provisionalNumber = takeProvisional();
      const items = cart.map((c) => ({
        productId: c.product.id,
        name: c.product.name,
        quantity: c.quantity,
        unitPriceCents: cartUnitPriceCents(c),
        modifiers: c.modifiers.map((m) => m.name),
        notes: c.notes?.trim() !== "" ? c.notes?.trim() : undefined,
      }));
      const event = await engine.enqueue(
        "order.create",
        {
          channel: "pos",
          table: effectiveTable || undefined,
          items: items.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            modifierNames: item.modifiers,
            notes: item.notes,
          })),
          totalCents: totals.totalCents,
          provisionalNumber,
        },
        provisionalNumber,
      );
      const order: LocalOrder = {
        clientUuid: event.clientUuid,
        provisionalNumber,
        table: effectiveTable,
        items: items.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          modifiers: item.modifiers,
          notes: item.notes,
        })),
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        totalCents: totals.totalCents,
        createdAt: new Date().toISOString(),
      };
      setLocalOrders((prev) => [...prev, order]);
      dispatchCart({ type: "clear" });
      setDiscountPct(0);
      await refreshPending();

      if (offlineRef.current) {
        showBanner("info", `Comanda L-${provisionalNumber} en cola — se enviará al reconectar`);
        return;
      }
      const result = await engine.sync();
      await refreshPending();
      const definitive = result.numbers[event.clientUuid];
      if (definitive != null) {
        setLocalOrders((prev) =>
          prev.map((o) =>
            o.clientUuid === event.clientUuid ? { ...o, number: definitive } : o,
          ),
        );
        showBanner(
          "success",
          `Comanda L-${provisionalNumber} enviada a cocina · folio definitivo #${definitive}`,
        );
      } else if (result.synced.length > 0) {
        showBanner("success", `Comanda L-${provisionalNumber} enviada a cocina`);
      } else {
        showBanner(
          "warning",
          `Comanda L-${provisionalNumber} quedó en cola — sin conexión con el servidor`,
        );
      }
    } finally {
      setSending(false);
    }
  }

  // ── Cobrar desde Vender: snapshot del carrito (se crea la orden al pagar) ──
  function chargeCart() {
    if (cart.length === 0) return;
    const payable: PayableOrder = {
      id: "cart",
      source: "cart",
      needsCreate: true,
      channel: "pos",
      table: effectiveTable,
      staffName: STAFF_NAME,
      items: cart.map((c) => ({
        productId: c.product.id,
        name: c.product.name,
        quantity: c.quantity,
        unitPriceCents: cartUnitPriceCents(c),
        modifiers: c.modifiers.map((m) => m.name),
        notes: c.notes?.trim() !== "" ? c.notes?.trim() : undefined,
      })),
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      totalCents: totals.totalCents,
    };
    setCheckout(payable);
  }

  // ── Confirmar cobro: encola order.pay (+ order.create si es el carrito), ───
  // marca la orden como pagada y registra el pago de la sesión (Caja).
  async function completePayment(
    order: PayableOrder,
    payment: PaymentConfirmation,
  ): Promise<{ definitiveNumber?: number }> {
    let definitiveNumber: number | undefined;
    let provisionalNumber = order.provisionalNumber;
    let createUuid: string | undefined;
    try {
      if (order.needsCreate) {
        provisionalNumber = takeProvisional();
        const createEvent = await engine.enqueue(
          "order.create",
          {
            channel: "pos",
            table: order.table,
            items: order.items.map((item) => ({
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              modifierNames: item.modifiers,
              notes: item.notes,
            })),
            totalCents: order.totalCents,
            provisionalNumber,
          },
          provisionalNumber,
        );
        createUuid = createEvent.clientUuid;
      }
      await engine.enqueue("order.pay", {
        number: order.number,
        provisionalNumber: order.number != null ? undefined : provisionalNumber,
        method: payment.method,
        amountCents: payment.amountCents,
        tipCents: payment.tipCents,
        changeCents: payment.changeCents,
      });
      if (!offlineRef.current) {
        const result = await engine.sync();
        if (createUuid != null && result.numbers[createUuid] != null) {
          definitiveNumber = result.numbers[createUuid];
        }
      }
    } catch {
      /* red caída: los eventos quedan en cola y se drenan al reconectar */
    }
    await refreshPending();

    const ticketNumber =
      definitiveNumber != null
        ? `#${definitiveNumber}`
        : order.number != null
          ? `#${order.number}`
          : `L-${provisionalNumber ?? 0}`;
    const sessionPayment: SessionPayment = {
      id: uuidv7(),
      ticketNumber,
      number: definitiveNumber ?? order.number,
      provisionalNumber,
      table: order.table,
      method: payment.method,
      amountCents: payment.amountCents,
      subtotalCents: order.subtotalCents,
      tipCents: payment.tipCents,
      changeCents: payment.changeCents,
      cashCents: payment.cashCents,
      cardCents: payment.cardCents,
      cashInDrawerCents:
        payment.method === "cash"
          ? payment.amountCents
          : payment.method === "mixed"
            ? payment.cashCents
            : 0,
      itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: new Date().toISOString(),
    };
    setPayments((prev) => [...prev, sessionPayment]);
    if (order.source === "local") {
      setLocalOrders((prev) => prev.filter((o) => o.clientUuid !== order.id));
    }
    if (order.source === "remote" && order.number != null) {
      const number = order.number;
      setChargedNumbers((prev) => (prev.includes(number) ? prev : [...prev, number]));
    }
    if (order.source === "cart") {
      dispatchCart({ type: "clear" });
      setDiscountPct(0);
    }
    return { definitiveNumber };
  }

  // ── Impresión térmica real: encoder ESC/POS + Bluetooth/USB/Serial ─────────
  // El picker maneja conexión y test print; sin impresora, el ticket va a cola.
  const [printerState, setPrinterState] = useState(thermalPrinter.getState());
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => thermalPrinter.subscribe(setPrinterState), []);
  useEffect(() => {
    void thermalPrinter.tryReconnect();
  }, []);

  /** Ticket a la cola honesta (contador persistido) cuando no hay impresora. */
  function queuePrint() {
    setPrintQueue((q) => q + 1);
    showBanner(
      "warning",
      "Sin impresora conectada — el ticket quedó en la cola de impresión",
      6_000,
    );
  }

  // ── Toggle "sin internet" ──────────────────────────────────────────────────
  function toggleOffline() {
    const next = !offline;
    setOffline(next);
    offlineRef.current = next;
    if (next) {
      showBanner("info", "Modo sin internet: los eventos solo se encolan");
    } else {
      showBanner("info", "Conexión restaurada — sincronizando…", 2_500);
      void runSync(false);
    }
  }

  // ── Caja: reinicio de turno (los pagos de la sesión van a cero) ────────────
  const [shiftStartedAt, setShiftStartedAt] = useState(() => new Date().toISOString());
  const [countedDigits, setCountedDigits] = usePersistedState<string>(
    "rest.pos.countedDigits",
    "",
  );
  useEffect(() => {
    const saved = loadJson<string | null>("rest.pos.shiftStart", null);
    if (saved) {
      setShiftStartedAt(saved);
    } else {
      saveJson("rest.pos.shiftStart", new Date().toISOString());
    }
  }, []);

  function resetShift() {
    setPayments([]);
    setCountedDigits("");
    const startedAt = new Date().toISOString();
    saveJson("rest.pos.shiftStart", startedAt);
    setShiftStartedAt(startedAt);
    showBanner("success", "Turno reiniciado — caja en ceros");
  }

  const openCount =
    localOrders.length + remoteOrders.filter((o) => !chargedNumbers.includes(o.number)).length;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      {/* Barra superior: contexto + catálogo + offline + sync + impresora */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 text-sm">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
          R
        </span>
        <span className="hidden max-w-44 truncate font-semibold sm:inline">
          {catalog.organization.name}
        </span>
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {STAFF_NAME} · PIN ok
        </Badge>
        {catalogSource === "live" ? (
          <Badge variant="success">
            <Wifi className="size-3" /> Catálogo online
          </Badge>
        ) : catalogSource === "cache" ? (
          <Badge variant="info">
            <Cloud className="size-3" /> Catálogo en caché
          </Badge>
        ) : catalogSource === "demo" ? (
          <Badge variant="warning">
            <CloudOff className="size-3" /> Offline demo
          </Badge>
        ) : (
          <Badge variant="outline">
            <RefreshCw className="size-3 animate-spin" /> Cargando catálogo…
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block">
            <PrinterStatusChip onOpen={() => setPickerOpen(true)} />
          </div>
          <Badge variant={pending > 0 ? "warning" : "success"}>
            <Cloud className="size-3" />
            {pending > 0 ? `${pending} sin sincronizar` : "Sincronizado"}
          </Badge>
          <button
            type="button"
            role="switch"
            aria-checked={offline}
            aria-label="Modo sin internet"
            onClick={toggleOffline}
            className={cn(
              "flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors",
              offline
                ? "border-warning/40 bg-warning/10 text-warning-text"
                : "border-border bg-background text-muted-foreground hover:border-warning/40",
            )}
          >
            <CloudOff className="size-3.5" />
            Sin internet
            <span
              className={cn(
                "relative h-4 w-7 rounded-full transition-colors",
                offline ? "bg-warning" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-3 rounded-full bg-white shadow transition-all",
                  offline ? "left-3.5" : "left-0.5",
                )}
              />
            </span>
          </button>
        </div>
      </header>

      {/* Banner suave de feedback */}
      {banner && (
        <div
          role="status"
          className={cn(
            "shrink-0 border-b px-4 py-2.5 text-center text-sm font-medium",
            banner.kind === "success" &&
              "border-success/20 bg-success/10 text-success-text",
            banner.kind === "warning" &&
              "border-warning/20 bg-warning/10 text-warning-text",
            banner.kind === "info" && "border-info/20 bg-info/10 text-info-text",
          )}
        >
          {banner.text}
        </div>
      )}

      {/* Pestañas */}
      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === "sell" && (
          <SellTab
            categories={catalog.categories}
            products={catalog.products}
            tables={tables}
            table={effectiveTable}
            onTableChange={setTable}
            cart={cart}
            dispatch={dispatchCart}
            discountPct={discountPct}
            onDiscountChange={setDiscountPct}
            subtotalCents={totals.subtotalCents}
            discountCents={totals.discountCents}
            totalCents={totals.totalCents}
            sending={sending}
            onSend={() => void sendToKitchen()}
            onCharge={chargeCart}
          />
        )}
        {tab === "orders" && (
          <OrdersTab
            localOrders={localOrders}
            remoteOrders={remoteOrders.filter((o) => !chargedNumbers.includes(o.number))}
            remoteState={remoteState}
            onRefresh={() => void refreshRemote()}
            onCharge={(order) => setCheckout(order)}
          />
        )}
        {tab === "cash" && (
          <CashTab
            payments={payments}
            shiftStartedAt={shiftStartedAt}
            organizationName={catalog.organization.name}
            locationName={catalog.location.name}
            countedDigits={countedDigits}
            onCountedDigitsChange={setCountedDigits}
            onPrintCut={queuePrint}
            onResetShift={resetShift}
          />
        )}
      </main>

      {/* Navegación inferior: 3 pestañas grandes (targets ≥56px) */}
      <nav className="flex shrink-0 border-t bg-card" aria-label="Secciones del POS">
        {TABS.map((t) => {
          const active = tab === t.id;
          const badge = t.id === "orders" && openCount > 0 ? openCount : null;
          return (
            <button
              key={t.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex h-16 min-w-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors",
                active ? "bg-primary/5 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-5" />
              {t.label}
              {badge != null && (
                <span className="absolute right-[calc(50%-28px)] top-2 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Flujo de cobro */}
      {checkout && (
        <PaymentSheet
          order={checkout}
          organizationName={catalog.organization.name}
          locationName={catalog.location.name}
          staffName={STAFF_NAME}
          onClose={() => setCheckout(null)}
          onConfirm={(payment) => completePayment(checkout, payment)}
          onPrint={queuePrint}
        />
      )}

      <HelpButton />
      {/* Selector/estado de impresora térmica */}
      <PrinterPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
