"use client";

import {
  Building2,
  Check,
  Copy,
  CreditCard,
  Download,
  KeyRound,
  MapPin,
  MessageCircle,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, cn } from "@rest/ui";
import { formatMoney } from "@rest/printer";
import { ORG_SLUG } from "@/lib/use-api";
import { MENU_ITEMS } from "../menu/data";

// ── Tipos y datos demo ───────────────────────────────────────────────────────

type Seccion = "negocio" | "locales" | "impresoras" | "pagos" | "whatsapp" | "suscripcion";

const ORG_HEADERS = { "X-Org-Slug": ORG_SLUG } as const;

// ── Contrato de la API real (suscripción + API pública F5) ──────────────────
// GET    /api/billing              → plan actual, uso y catálogo de planes
// POST   /api/billing {plan, orgSlug}
// GET    /api/keys?orgSlug=…       → { keys }
// POST   /api/keys {name, orgSlug} → { key } (secreto visible una sola vez)
// DELETE /api/keys?id=&orgSlug=    → revoca

interface PlanInfo {
  id: string;
  label: string;
  priceCents: number;
  monthlyOrders: number;
  maxLocations: number;
}

interface BillingPayload {
  plan: string;
  priceCents: number;
  ordersThisMonth: number;
  monthlyOrders: number;
  maxLocations: number;
  plans: PlanInfo[];
}

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
}

const FALLBACK_BILLING: BillingPayload = {
  plan: "pro",
  priceCents: 39_900,
  ordersThisMonth: 3_214,
  monthlyOrders: 5_000,
  maxLocations: 2,
  plans: [
    { id: "free", label: "Gratis", priceCents: 0, monthlyOrders: 100, maxLocations: 1 },
    { id: "pro", label: "Pro", priceCents: 39_900, monthlyOrders: 5_000, maxLocations: 2 },
    { id: "multi", label: "Multi-ubicación", priceCents: 119_900, monthlyOrders: 50_000, maxLocations: 10 },
  ],
};

const SECCIONES: { id: Seccion; label: string; icon: LucideIcon }[] = [
  { id: "negocio", label: "Negocio", icon: Building2 },
  { id: "locales", label: "Locales", icon: MapPin },
  { id: "impresoras", label: "Impresoras", icon: Printer },
  { id: "pagos", label: "Pagos", icon: CreditCard },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "suscripcion", label: "Suscripción", icon: Sparkles },
];

interface LocalInfo {
  id: string;
  nombre: string;
  direccion: string;
  activo: boolean;
}

interface Impresora {
  id: string;
  nombre: string;
  tipo: "Bluetooth" | "USB" | "Red";
  detalle: string;
  conectada: boolean;
}

interface Plantilla {
  id: string;
  nombre: string;
  texto: string;
}

const LOCALES_INICIALES: LocalInfo[] = [
  { id: "l1", nombre: "Centro", direccion: "Av. Juárez 123, Centro, CDMX", activo: true },
  { id: "l2", nombre: "Polanco", direccion: "Av. Presidente Masaryk 45, Polanco, CDMX", activo: true },
];

const IMPRESORAS_INICIALES: Impresora[] = [
  { id: "pr1", nombre: "Termo cocina 80mm", tipo: "Bluetooth", detalle: "Bluetooth", conectada: true },
  { id: "pr2", nombre: "Termo barra 58mm", tipo: "Red", detalle: "Red 192.168.1.50", conectada: true },
];

const PLANTILLAS_INICIALES: Plantilla[] = [
  { id: "t1", nombre: "Bienvenida", texto: "¡Hola! Bienvenido a Cevichería El Muelle 🌮 ¿Qué te preparo hoy?" },
  { id: "t2", nombre: "Confirmación de pedido", texto: "Pedido {número} confirmado. Te avisamos cuando salga a reparto." },
  { id: "t3", nombre: "Pedido listo", texto: "¡Tu pedido {número} está listo! Pásalo a recoger en mostrador." },
];

const MONEDAS = ["PEN", "EUR", "COP", "ARS", "CLP", "PEN"] as const;

const ZONAS_HORARIAS = [
  "America/America/Lima",
  "America/Monterrey",
  "America/Tijuana",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "Europe/Madrid",
] as const;

// ── Piezas de UI ─────────────────────────────────────────────────────────────

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex cursor-pointer items-center gap-2 text-sm"
    >
      <span
        className={cn(
          "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "bg-primary" : "bg-muted ring-1 ring-border",
        )}
      >
        <span
          className={cn("size-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4" : "translate-x-0")}
        />
      </span>
      {label}
    </button>
  );
}

function ModalShell({
  titulo,
  descripcion,
  onClose,
  children,
  wide,
}: {
  titulo: string;
  descripcion: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={titulo}>
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div
        className={cn(
          "absolute inset-x-4 top-1/2 mx-auto max-h-[90dvh] -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-6 shadow-xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2",
          wide ? "max-w-lg" : "max-w-md",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
            <p className="text-sm text-muted-foreground">{descripcion}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Barra de progreso en escala monocroma del acento. */
function BarraUso({ label, actual, limite, color }: { label: string; actual: number; limite: number; color: string }) {
  const pct = Math.min(100, Math.round((actual / limite) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {actual.toLocaleString("es-PE")} de {limite.toLocaleString("es-PE")}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% de ${label}`}
      >
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Modal: agregar local ─────────────────────────────────────────────────────

function AgregarLocalModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (nombre: string, direccion: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const valido = nombre.trim().length > 0 && direccion.trim().length > 0;

  return (
    <ModalShell titulo="Agregar local" descripcion="Se activa al instante en todos los canales." onClose={onClose}>
      <div className="mt-4 space-y-4">
        <Field label="Nombre del local" htmlFor="local-nombre">
          <Input id="local-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Roma Norte" />
        </Field>
        <Field label="Dirección" htmlFor="local-dir">
          <Input id="local-dir" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, número, colonia" />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={!valido}
          onClick={() => onAdd(nombre.trim(), direccion.trim())}
        >
          Agregar local
        </Button>
      </div>
    </ModalShell>
  );
}

// ── Wizard: agregar impresora (3 pasos) ──────────────────────────────────────

const TIPOS_IMPRESORA = ["Bluetooth", "USB", "Red"] as const;
type TipoImpresora = (typeof TIPOS_IMPRESORA)[number];

const DISPOSITIVOS_BT = [
  { id: "bt1", nombre: "RK58 BT (58mm)" },
  { id: "bt2", nombre: "XM-T1 mini (80mm)" },
];

function WizardImpresora({
  onClose,
  onAdd,
  onPrueba,
}: {
  onClose: () => void;
  onAdd: (impresora: Omit<Impresora, "id">) => void;
  onPrueba: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<TipoImpresora | null>(null);
  const [dispositivo, setDispositivo] = useState<string | null>(null);
  const [ip, setIp] = useState("192.168.1.");
  const [nombre, setNombre] = useState("");
  const [pruebaEnviada, setPruebaEnviada] = useState(false);

  const ipValida = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
  const paso2Ok =
    tipo === "Bluetooth" ? dispositivo !== null : tipo === "USB" ? dispositivo !== null : tipo === "Red" ? ipValida : false;

  const agregar = () => {
    if (!tipo) return;
    onAdd({
      nombre: nombre.trim(),
      tipo,
      detalle: tipo === "Red" ? `Red ${ip}` : tipo,
      conectada: true,
    });
  };

  return (
    <ModalShell
      titulo="Agregar impresora"
      descripcion={`Paso ${step} de 3 · ${step === 1 ? "elige el tipo de conexión" : step === 2 ? "conecta el dispositivo" : "nómbrala y prueba"}`}
      onClose={onClose}
    >
      {step === 1 && (
        <div className="mt-4 space-y-2">
          {TIPOS_IMPRESORA.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tipo === t}
              onClick={() => setTipo(t)}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                tipo === t ? "border-primary/30 bg-primary/10" : "hover:bg-muted",
              )}
            >
              <span>
                <span className="font-medium">{t}</span>
                <span className="block text-xs text-muted-foreground">
                  {t === "Bluetooth" && "Emparejamiento directo con el dispositivo (Chrome/Edge en Android)"}
                  {t === "USB" && "Cable OTG desde la tablet o el teléfono"}
                  {t === "Red" && "Impresora con IP fija en la red del local"}
                </span>
              </span>
              {tipo === t && <span className="size-2 rounded-full bg-primary" aria-hidden />}
            </button>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button disabled={!tipo} onClick={() => setStep(2)}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 2 && tipo === "Bluetooth" && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">Dispositivos cercanos encontrados:</p>
          {DISPOSITIVOS_BT.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={dispositivo === d.nombre}
              onClick={() => setDispositivo(d.nombre)}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                dispositivo === d.nombre ? "border-primary/30 bg-primary/10" : "hover:bg-muted",
              )}
            >
              <span className="font-medium">{d.nombre}</span>
              {dispositivo === d.nombre && <span className="size-2 rounded-full bg-success" aria-hidden />}
            </button>
          ))}
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Atrás
            </Button>
            <Button disabled={!paso2Ok} onClick={() => setStep(3)}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 2 && tipo === "USB" && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Conecta la impresora por cable USB-OTG y presiona Detectar. Solo navegadores basados en Chrome.
          </p>
          {dispositivo && (
            <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 px-3 py-2 text-sm text-success-text">
              <span className="size-2 rounded-full bg-success" aria-hidden />
              USB conectada: {dispositivo}
            </div>
          )}
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Atrás
            </Button>
            {dispositivo ? (
              <Button onClick={() => setStep(3)}>Continuar</Button>
            ) : (
              <Button onClick={() => setDispositivo("Termo USB (80mm)")}>Detectar USB</Button>
            )}
          </div>
        </div>
      )}

      {step === 2 && tipo === "Red" && (
        <div className="mt-4 space-y-3">
          <Field label="Dirección IP de la impresora" htmlFor="imp-ip">
            <Input id="imp-ip" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.50" />
          </Field>
          {!ipValida && ip.length > 0 && <p className="text-xs text-danger-text">Formato esperado: 192.168.1.50</p>}
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Atrás
            </Button>
            <Button disabled={!paso2Ok} onClick={() => setStep(3)}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-4 space-y-4">
          <Field label="Nombre para identificarla" htmlFor="imp-nombre">
            <Input
              id="imp-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Termo barra 2"
              autoFocus
            />
          </Field>
          {pruebaEnviada && (
            <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 px-3 py-2 text-sm text-success-text">
              <span className="size-2 rounded-full bg-success" aria-hidden />
              Página de prueba enviada a la cola de impresión.
            </div>
          )}
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              Atrás
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setPruebaEnviada(true); onPrueba(); }} disabled={!nombre.trim()}>
                Imprimir página de prueba
              </Button>
              <Button disabled={!nombre.trim()} onClick={agregar}>
                Agregar impresora
              </Button>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function ConfigPage() {
  const [seccion, setSeccion] = useState<Seccion>("negocio");
  const [banner, setBanner] = useState<{ kind: "success" | "warning" | "danger"; text: string } | null>(null);

  // Negocio
  const [nombreNegocio, setNombreNegocio] = useState("Cevichería El Muelle");
  const [rfc, setRfc] = useState("");
  const [moneda, setMoneda] = useState<string>("PEN");
  const [zonaHoraria, setZonaHoraria] = useState<string>("America/America/Lima");

  // Locales
  const [locales, setLocales] = useState<LocalInfo[]>(LOCALES_INICIALES);
  const [localModal, setLocalModal] = useState(false);

  // Impresoras
  const [impresoras, setImpresoras] = useState<Impresora[]>(IMPRESORAS_INICIALES);
  const [wizard, setWizard] = useState(false);

  // Pagos
  const [mercadopago, setMercadopago] = useState(false);
  const [stripe, setStripe] = useState(false);
  const [propina, setPropina] = useState(true);
  const [propinaPct, setPropinaPct] = useState(15);

  // WhatsApp
  const [numero, setNumero] = useState("+51 91234 5678");
  const [plantillas, setPlantillas] = useState<Plantilla[]>(PLANTILLAS_INICIALES);

  // Suscripción (API real)
  const [billing, setBilling] = useState<BillingPayload>(FALLBACK_BILLING);
  const [billingSource, setBillingSource] = useState<"loading" | "live" | "demo">("loading");
  const [cambiandoPlan, setCambiandoPlan] = useState<string | null>(null);

  // API pública (F5)
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [keysSource, setKeysSource] = useState<"loading" | "live" | "demo">("loading");
  const [nuevaLlave, setNuevaLlave] = useState("");
  const [creandoLlave, setCreandoLlave] = useState(false);
  const [secretoNuevo, setSecretoNuevo] = useState<{ name: string; full: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // ── GET /api/billing ──
  const loadBilling = useCallback(async () => {
    setBillingSource("loading");
    try {
      const res = await fetch("/api/billing", { headers: ORG_HEADERS, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBilling((await res.json()) as BillingPayload);
      setBillingSource("live");
    } catch {
      setBilling(FALLBACK_BILLING);
      setBillingSource("demo");
    }
  }, []);

  // ── GET /api/keys?orgSlug= ──
  const loadKeys = useCallback(async () => {
    setKeysSource("loading");
    try {
      const res = await fetch(`/api/keys?orgSlug=${encodeURIComponent(ORG_SLUG)}`, {
        headers: ORG_HEADERS,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { keys?: KeyRow[] };
      setKeys(data.keys ?? []);
      setKeysSource("live");
    } catch {
      setKeys([]);
      setKeysSource("demo");
    }
  }, []);

  useEffect(() => {
    void loadBilling();
    void loadKeys();
  }, [loadBilling, loadKeys]);

  // ── POST /api/billing {plan, orgSlug} ──
  const cambiarPlan = async (planId: string) => {
    setCambiandoPlan(planId);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { ...ORG_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, orgSlug: ORG_SLUG }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBanner({ kind: "success", text: "Plan actualizado (sandbox — en producción: checkout Stripe/MercadoPago)." });
      void loadBilling();
    } catch {
      setBanner({ kind: "danger", text: "No se pudo actualizar el plan: la API no respondió." });
    } finally {
      setCambiandoPlan(null);
    }
  };

  // ── POST /api/keys {name, orgSlug} — el secreto se muestra UNA vez ──
  const crearLlave = async () => {
    const name = nuevaLlave.trim();
    if (!name || creandoLlave) return;
    setCreandoLlave(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { ...ORG_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ name, orgSlug: ORG_SLUG }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { key?: string };
      setSecretoNuevo({ name, full: data.key ?? "" });
      setCopiado(false);
      setNuevaLlave("");
      void loadKeys();
    } catch {
      setBanner({ kind: "danger", text: "No se pudo crear la llave: la API no respondió." });
    } finally {
      setCreandoLlave(false);
    }
  };

  // ── DELETE /api/keys?id=&orgSlug= ──
  const revocarLlave = async (k: KeyRow) => {
    try {
      const res = await fetch(`/api/keys?id=${encodeURIComponent(k.id)}&orgSlug=${encodeURIComponent(ORG_SLUG)}`, {
        method: "DELETE",
        headers: ORG_HEADERS,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (secretoNuevo?.name === k.name) setSecretoNuevo(null);
      setBanner({ kind: "success", text: `Llave "${k.name}" revocada. Las integraciones que la usen dejarán de funcionar.` });
      void loadKeys();
    } catch {
      setBanner({ kind: "danger", text: "No se pudo revocar la llave: la API no respondió." });
    }
  };

  const copiarSecreto = async () => {
    if (!secretoNuevo) return;
    try {
      await navigator.clipboard.writeText(secretoNuevo.full);
      setCopiado(true);
    } catch {
      setBanner({ kind: "warning", text: "El navegador bloqueó el portapapeles: copia el secreto manualmente." });
    }
  };

  const exportarDatos = () => {
    const payload = {
      exportadoEl: new Date().toISOString(),
      negocio: { nombre: nombreNegocio, rfc, moneda, zonaHoraria },
      locales,
      impresoras,
      pagos: { efectivo: true, mercadopago, stripe, propina, propinaPct },
      whatsapp: { numero, verificado: true, plantillas },
      suscripcion: { plan: billing.plan, precioMensualCents: billing.priceCents },
      productos: MENU_ITEMS,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cevicheria-el-muelle-datos.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setBanner({ kind: "success", text: "Exportación descargada: tus datos en JSON, sin trabas." });
  };

  const bannerClases =
    banner?.kind === "success"
      ? "border-success/20 bg-success/10 text-success-text"
      : banner?.kind === "warning"
        ? "border-warning/20 bg-warning/10 text-warning-text"
        : "border-destructive/20 bg-destructive/10 text-danger-text";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">Negocio, locales, impresoras, pagos, WhatsApp y suscripción</p>
      </div>

      {banner && (
        <div role="status" className={cn("flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm", bannerClases)}>
          <span>{banner.text}</span>
          <Button variant="ghost" size="icon" onClick={() => setBanner(null)} aria-label="Descartar aviso">
            <X />
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Secciones de configuración" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-current={seccion === s.id ? "page" : undefined}
              onClick={() => setSeccion(s.id)}
              className={cn(
                "flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
                seccion === s.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <s.icon className="size-4" aria-hidden />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-4">
          {/* ── Negocio ── */}
          {seccion === "negocio" && (
            <Card>
              <CardHeader>
                <CardTitle>Negocio</CardTitle>
                <p className="text-sm text-muted-foreground">Datos fiscales y preferencias regionales.</p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Nombre del negocio" htmlFor="cfg-nombre">
                    <Input id="cfg-nombre" value={nombreNegocio} onChange={(e) => setNombreNegocio(e.target.value)} />
                  </Field>
                </div>
                <Field label="RFC (opcional)" htmlFor="cfg-rfc">
                  <Input id="cfg-rfc" value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} placeholder="TES240101XXX" maxLength={13} />
                </Field>
                <Field label="Moneda" htmlFor="cfg-moneda">
                  <select id="cfg-moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)} className={inputCls}>
                    {MONEDAS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Zona horaria" htmlFor="cfg-zona">
                  <select id="cfg-zona" value={zonaHoraria} onChange={(e) => setZonaHoraria(e.target.value)} className={inputCls}>
                    {ZONAS_HORARIAS.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex items-end justify-end sm:col-span-2">
                  <Button onClick={() => setBanner({ kind: "success", text: "Cambios guardados." })}>Guardar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Locales ── */}
          {seccion === "locales" && (
            <Card>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="space-y-1.5">
                  <CardTitle>Locales</CardTitle>
                  <p className="text-sm text-muted-foreground">Cada local comparte menú y reportes consolidados.</p>
                </div>
                <Button size="sm" onClick={() => setLocalModal(true)}>
                  <Plus aria-hidden />
                  Agregar local
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {locales.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="font-medium">{l.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">{l.direccion}</p>
                    </div>
                    {l.activo && (
                      <Badge variant="success">
                        <span className="size-2 rounded-full bg-success" aria-hidden />
                        Activo
                      </Badge>
                    )}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Los pedidos de todos los locales aparecen consolidados en Reportes.
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── Impresoras ── */}
          {seccion === "impresoras" && (
            <Card>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="space-y-1.5">
                  <CardTitle>Impresoras</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Impresión vía Web Bluetooth/USB/Serial — Chrome/Edge en Android.
                  </p>
                </div>
                <Button size="sm" onClick={() => setWizard(true)}>
                  <Plus aria-hidden />
                  Agregar impresora
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {impresoras.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{p.nombre}</p>
                      <p className="text-xs text-muted-foreground">{p.detalle}</p>
                    </div>
                    {p.conectada ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-success-text">
                        <span className="size-2 rounded-full bg-success" aria-hidden />
                        Conectada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="size-2 rounded-full bg-muted-foreground/40" aria-hidden />
                        Sin conexión
                      </span>
                    )}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  La cola de impresión se sincroniza con KDS: cada comanda sale por cocina y barra.
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── Pagos ── */}
          {seccion === "pagos" && (
            <Card>
              <CardHeader>
                <CardTitle>Pagos</CardTitle>
                <p className="text-sm text-muted-foreground">Métodos de cobro en POS y en línea.</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">Efectivo</p>
                    <p className="text-xs text-muted-foreground">Siempre disponible, sin comisión.</p>
                  </div>
                  <Badge variant="success">
                    <span className="size-2 rounded-full bg-success" aria-hidden />
                    Activo
                  </Badge>
                </div>
                {[
                  { nombre: "MercadoPago", desc: "Cobros con link y QR en el POS.", conectado: mercadopago, set: setMercadopago },
                  { nombre: "Stripe", desc: "Pagos con tarjeta para pedidos en línea.", conectado: stripe, set: setStripe },
                ].map((p) => (
                  <div key={p.nombre} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{p.nombre}</p>
                      <p className="text-xs text-muted-foreground">{p.desc}</p>
                    </div>
                    {p.conectado ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="success">
                          <span className="size-2 rounded-full bg-success" aria-hidden />
                          Conectado
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => { p.set(false); setBanner({ kind: "success", text: `${p.nombre} desconectado (demo).` }); }}>
                          Desconectar
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => { p.set(true); setBanner({ kind: "success", text: `${p.nombre} conectado (demo).` }); }}>
                        Conectar
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">Propina</p>
                    <p className="text-xs text-muted-foreground">Se sugiere al cobrar y va 100% al equipo.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {propina && (
                      <select
                        aria-label="Porcentaje de propina sugerido"
                        value={propinaPct}
                        onChange={(e) => setPropinaPct(Number(e.target.value))}
                        className={cn(inputCls, "w-24")}
                      >
                        {[10, 15, 18].map((p) => (
                          <option key={p} value={p}>
                            {p}%
                          </option>
                        ))}
                      </select>
                    )}
                    <Toggle checked={propina} onChange={setPropina} label="Sugerir al cobrar" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── WhatsApp ── */}
          {seccion === "whatsapp" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>WhatsApp</CardTitle>
                  <p className="text-sm text-muted-foreground">Número conectado para recibir pedidos por chat.</p>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field label="Número de negocio" htmlFor="cfg-wa">
                    <Input id="cfg-wa" value={numero} onChange={(e) => setNumero(e.target.value)} />
                  </Field>
                  <Badge variant="success" className="h-9 px-3">
                    <span className="size-2 rounded-full bg-success" aria-hidden />
                    Verificado
                  </Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Plantillas de mensaje</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Respuestas rápidas del asistente; {"{número}"} se sustituye solo.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {plantillas.map((t) => (
                    <div key={t.id} className="space-y-1.5">
                      <label htmlFor={`tpl-${t.id}`} className="block text-xs font-medium text-muted-foreground">
                        {t.nombre}
                      </label>
                      <textarea
                        id={`tpl-${t.id}`}
                        rows={2}
                        value={t.texto}
                        onChange={(e) =>
                          setPlantillas((prev) => prev.map((x) => (x.id === t.id ? { ...x, texto: e.target.value } : x)))
                        }
                        className={cn(inputCls, "h-auto min-h-16 py-2")}
                      />
                    </div>
                  ))}
                  <div className="flex justify-end">
                    <Button onClick={() => setBanner({ kind: "success", text: "Plantillas guardadas." })}>Guardar plantillas</Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ── Suscripción (API real) ── */}
          {seccion === "suscripcion" && (
            <>
              <Card>
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>Plan {billing.plans.find((p) => p.id === billing.plan)?.label ?? billing.plan}</CardTitle>
                      <Badge variant="success">
                        <span className="size-2 rounded-full bg-success" aria-hidden />
                        Activa
                      </Badge>
                      {billingSource === "live" && (
                        <Badge variant="success">
                          <span className="size-1.5 rounded-full bg-success" aria-hidden /> en vivo
                        </Badge>
                      )}
                      {billingSource === "demo" && (
                        <Badge variant="warning">
                          <span className="size-1.5 rounded-full bg-warning" aria-hidden /> demo
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatMoney(billing.priceCents)} / mes · hasta {billing.maxLocations}{" "}
                      {billing.maxLocations === 1 ? "local" : "locales"} · sin permanencia.
                    </p>
                  </div>
                  <Badge variant="default">{billing.plan}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <BarraUso
                    label="Pedidos del mes"
                    actual={billing.ordersThisMonth}
                    limite={billing.monthlyOrders}
                    color="bg-primary"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={exportarDatos}>
                      <Download aria-hidden />
                      Exportar mis datos
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Anti-lock-in: tus datos son tuyos. Exporta en JSON cuando quieras, con o sin suscripción vigente.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cambiar de plan</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    El cambio aplica al instante en sandbox; en producción pasa por checkout.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  {billing.plans.map((p) => {
                    const actual = p.id === billing.plan;
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "flex flex-col rounded-xl border p-4",
                          actual ? "border-primary/30 bg-primary/5" : "bg-card",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{p.label}</p>
                          {actual && <Badge variant="default">Actual</Badge>}
                        </div>
                        <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
                          {p.priceCents === 0 ? "Gratis" : formatMoney(p.priceCents)}
                          {p.priceCents > 0 && <span className="text-sm font-normal text-muted-foreground"> / mes</span>}
                        </p>
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <li>{p.monthlyOrders.toLocaleString("es-PE")} pedidos / mes</li>
                          <li>
                            Hasta {p.maxLocations} {p.maxLocations === 1 ? "local" : "locales"}
                          </li>
                        </ul>
                        <Button
                          className="mt-3 w-full"
                          size="sm"
                          variant={actual ? "outline" : "default"}
                          disabled={actual || cambiandoPlan !== null}
                          onClick={() => void cambiarPlan(p.id)}
                        >
                          {actual ? "Plan actual" : cambiandoPlan === p.id ? "Cambiando…" : "Cambiar a este plan"}
                        </Button>
                      </div>
                    );
                  })}
                  {billing.plans.length === 0 && billingSource === "loading" && (
                    <p className="text-sm text-muted-foreground sm:col-span-3">Cargando planes…</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>API pública</CardTitle>
                      <Badge variant="outline">F5</Badge>
                      <KeyRound className="size-4 text-muted-foreground" aria-hidden />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Llaves para integraciones externas contra GET /api/public/v1/orders. El secreto se muestra una
                      sola vez.
                    </p>
                  </div>
                  {keysSource === "live" && (
                    <Badge variant="success">
                      <span className="size-1.5 rounded-full bg-success" aria-hidden /> en vivo
                    </Badge>
                  )}
                  {keysSource === "demo" && (
                    <Badge variant="warning">
                      <span className="size-1.5 rounded-full bg-warning" aria-hidden /> demo
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {secretoNuevo && (
                    <div className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-warning-text">
                      <p className="text-sm font-medium">Cópialo ahora: este secreto no volverá a mostrarse.</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-background px-2 py-1.5 font-mono text-xs text-foreground">
                          {secretoNuevo.full}
                        </code>
                        <Button size="sm" variant="outline" onClick={() => void copiarSecreto()}>
                          {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
                          {copiado ? "Copiado" : "Copiar"}
                        </Button>
                      </div>
                      <p className="mt-1.5 text-xs">Llave “{secretoNuevo.name}”.</p>
                    </div>
                  )}

                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void crearLlave();
                    }}
                  >
                    <div className="min-w-48 flex-1 space-y-1.5">
                      <label htmlFor="key-name" className="block text-xs font-medium text-muted-foreground">
                        Nombre de la llave
                      </label>
                      <Input
                        id="key-name"
                        value={nuevaLlave}
                        onChange={(e) => setNuevaLlave(e.target.value)}
                        placeholder="Ej. Integración Rappi"
                        maxLength={60}
                      />
                    </div>
                    <Button type="submit" disabled={!nuevaLlave.trim() || creandoLlave}>
                      <Plus aria-hidden />
                      Crear llave
                    </Button>
                  </form>

                  <ul className="space-y-2">
                    {keys.map((k) => (
                      <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                        <div className="min-w-0">
                          <p className="font-medium">{k.name}</p>
                          <p className="text-xs text-muted-foreground">
                            <code className="font-mono">{k.prefix}…</code> · creada el{" "}
                            {new Date(k.createdAt).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger-text hover:bg-destructive/10"
                          onClick={() => void revocarLlave(k)}
                        >
                          <Trash2 aria-hidden />
                          Revocar
                        </Button>
                      </li>
                    ))}
                    {keys.length === 0 && keysSource !== "loading" && (
                      <li className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                        Sin llaves activas. Crea una para conectar canales externos.
                      </li>
                    )}
                    {keysSource === "loading" && (
                      <li className="text-sm text-muted-foreground">Cargando llaves…</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {localModal && (
        <AgregarLocalModal
          onClose={() => setLocalModal(false)}
          onAdd={(nombre, direccion) => {
            setLocales((prev) => [...prev, { id: crypto.randomUUID(), nombre, direccion, activo: true }]);
            setLocalModal(false);
            setBanner({ kind: "success", text: `Local ${nombre} agregado y activo en todos los canales.` });
          }}
        />
      )}

      {wizard && (
        <WizardImpresora
          onClose={() => setWizard(false)}
          onPrueba={() => setBanner({ kind: "success", text: "Prueba enviada a la cola de impresión." })}
          onAdd={(impresora) => {
            setImpresoras((prev) => [...prev, { id: crypto.randomUUID(), ...impresora }]);
            setWizard(false);
            setBanner({ kind: "success", text: `Impresora ${impresora.nombre} agregada.` });
          }}
        />
      )}
    </div>
  );
}
