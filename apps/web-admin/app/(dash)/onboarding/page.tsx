"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  Printer,
  QrCode,
  Store,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, buttonVariants, cn } from "@rest/ui";
import { ORG_SLUG } from "@/lib/use-api";

/**
 * Onboarding self-serve (F2) — wizard de 4 pasos con barra de progreso.
 * El paso actual persiste en localStorage. El menú se crea de verdad vía
 * POST /api/products (header X-Org-Slug); QRs vía GET /api/qr (SVG).
 */

const STEP_KEY = "rest.onboarding.step";
const MENU_APP_URL = "http://localhost:3003"; // carta digital (QR)
const POS_DEMO_URL = "http://localhost:3001"; // POS de demo
const MESAS = ["M1", "M2", "M3", "M4", "M5", "M6"] as const;
const ROLES = ["Mesero", "Cocina", "Caja", "Encargado"] as const;

const FALLBACK_ORG = { name: "Cevichería El Muelle", currency: "PEN" };

interface OrgInfo {
  name: string;
  currency: string;
}

interface BootstrapResponse {
  organization: { name: string; slug: string; currency: string };
}

interface TemplateItem {
  name: string;
  priceCents: number;
  categoryName: string;
}

interface MenuTemplate {
  id: string;
  name: string;
  description: string;
  items: TemplateItem[];
}

interface ProductDraft {
  key: string;
  name: string;
  /** Precio en soles (PEN) tal como lo edita el usuario; se convierte a centavos al guardar. */
  price: string;
  categoryName: string;
}

type ItemStatus = "pending" | "creating" | "ok" | "error";

const TEMPLATES: MenuTemplate[] = [
  {
    id: "cevicheria",
    name: "Cevichería",
    description: "Los clásicos de la mesa peruana: ceviches, fondos y chicha.",
    items: [
      { name: "Ceviche de pescado", priceCents: 2500, categoryName: "Ceviches" },
      { name: "Ceviche mixto", priceCents: 3200, categoryName: "Ceviches" },
      { name: "Tiradito", priceCents: 2400, categoryName: "Ceviches" },
      { name: "Chicharrón de pescado", priceCents: 2600, categoryName: "Platos de fondo" },
      { name: "Arroz con mariscos", priceCents: 3000, categoryName: "Platos de fondo" },
      { name: "Chicha morada 600 ml", priceCents: 800, categoryName: "Bebidas" },
    ],
  },
  {
    id: "pizzeria",
    name: "Pizzería",
    description: "Pizzas al momento y para compartir, con sus complementos.",
    items: [
      { name: "Pizza margarita", priceCents: 3500, categoryName: "Pizzas" },
      { name: "Pizza de pepperoni", priceCents: 4200, categoryName: "Pizzas" },
      { name: "Pizza hawaiana", priceCents: 4000, categoryName: "Pizzas" },
      { name: "Pan de ajo con queso", priceCents: 1800, categoryName: "Pizzas" },
      { name: "Gaseosa 500 ml", priceCents: 700, categoryName: "Bebidas" },
    ],
  },
  {
    id: "cafeteria",
    name: "Cafetería",
    description: "Café de especialidad, pan dulce y algo ligero de comer.",
    items: [
      { name: "Café americano", priceCents: 900, categoryName: "Cafés" },
      { name: "Capuchino", priceCents: 1200, categoryName: "Cafés" },
      { name: "Latte de vainilla", priceCents: 1400, categoryName: "Cafés" },
      { name: "Pan dulce", priceCents: 700, categoryName: "Panadería" },
      { name: "Jugo de naranja natural", priceCents: 1200, categoryName: "Jugos" },
      { name: "Sánguche de jamón y queso", priceCents: 1800, categoryName: "Sandwiches" },
    ],
  },
  {
    id: "hamburguesas",
    name: "Hamburguesas",
    description: "Smash burgers, papas y malteadas para la clientela joven.",
    items: [
      { name: "Hamburguesa clásica", priceCents: 1800, categoryName: "Hamburguesas" },
      { name: "Hamburguesa con queso", priceCents: 2100, categoryName: "Hamburguesas" },
      { name: "Hamburguesa doble", priceCents: 2800, categoryName: "Hamburguesas" },
      { name: "Papas a la francesa", priceCents: 900, categoryName: "Acompañamientos" },
      { name: "Aros de cebolla", priceCents: 1000, categoryName: "Acompañamientos" },
      { name: "Malteada de vainilla", priceCents: 1500, categoryName: "Malteadas" },
    ],
  },
];

function initialDrafts(): Record<string, ProductDraft[]> {
  const entries = TEMPLATES.map((template): [string, ProductDraft[]] => [
    template.id,
    template.items.map((item, index) => ({
      key: `${template.id}-${index}`,
      name: item.name,
      price: (item.priceCents / 100).toString(),
      categoryName: item.categoryName,
    })),
  ]);
  return Object.fromEntries(entries);
}

function priceCentsOf(draft: ProductDraft): number {
  return Math.round(Number(draft.price) * 100);
}

function isValidDraft(draft: ProductDraft): boolean {
  const cents = priceCentsOf(draft);
  return draft.name.trim().length > 0 && Number.isFinite(cents) && cents > 0;
}

/** Reglas de impresión: todo el body se oculta (sidebar/topbar incluidas) y solo
 * la hoja de QRs sale en el papel. El resto de la página usa print:hidden. */
const PRINT_CSS = [
  "body * { visibility: hidden; }",
  "#qr-sheet, #qr-sheet * { visibility: visible; }",
  "#qr-sheet { position: absolute; top: 0; left: 0; width: 100%; }",
  "@page { margin: 12mm; }",
].join("\n");

function ItemStatusIcon({ status }: { status: ItemStatus }) {
  if (status === "creating") {
    return <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-label="Creando" />;
  }
  if (status === "ok") {
    return (
      <span
        role="img"
        aria-label="Producto creado"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success/10 text-success-text"
      >
        <Check className="size-3.5" aria-hidden />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        role="img"
        aria-label="Error al crear el producto"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-danger-text"
      >
        <X className="size-3.5" aria-hidden />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label="Pendiente de crear"
      className="size-2 shrink-0 rounded-full bg-muted-foreground/40"
    />
  );
}

interface WizardStep {
  n: number;
  label: string;
  icon: typeof Store;
}

const WIZARD_STEPS: WizardStep[] = [
  { n: 1, label: "Tu restaurante", icon: Store },
  { n: 2, label: "Tu menú inicial", icon: UtensilsCrossed },
  { n: 3, label: "Imprime tus QRs", icon: QrCode },
  { n: 4, label: "Invita a tu equipo", icon: Users },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [orgError, setOrgError] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]!.id);
  const [drafts, setDrafts] = useState<Record<string, ProductDraft[]>>(initialDrafts);
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>({});
  const [creating, setCreating] = useState(false);
  const [employees, setEmployees] = useState([
    { name: "", role: ROLES[0] as string },
    { name: "", role: ROLES[1] as string },
  ]);

  // Restaurar el paso guardado y cargar la org activa (bootstrap, mismo origen).
  useEffect(() => {
    const stored = Number(window.localStorage.getItem(STEP_KEY));
    if (Number.isInteger(stored) && stored >= 1 && stored <= 4) setStep(stored);

    let cancelled = false;
    fetch("/api/bootstrap", { headers: { "X-Org-Slug": ORG_SLUG } })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<BootstrapResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        setOrg({ name: data.organization.name, currency: data.organization.currency });
      })
      .catch(() => {
        if (!cancelled) setOrgError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persistir el paso actual.
  useEffect(() => {
    window.localStorage.setItem(STEP_KEY, String(step));
  }, [step]);

  const selectedDrafts = useMemo(() => drafts[selectedTemplate] ?? [], [drafts, selectedTemplate]);
  const createdCount = useMemo(
    () => Object.values(statuses).filter((s) => s === "ok").length,
    [statuses],
  );
  const hasInvalid = selectedDrafts.some((draft) => !isValidDraft(draft));
  const menuDone =
    selectedDrafts.length > 0 &&
    selectedDrafts.every((draft) => statuses[draft.key] === "ok" || !isValidDraft(draft));

  const orgName = org?.name ?? FALLBACK_ORG.name;
  const invitedNames = employees.map((e) => e.name.trim()).filter((name) => name.length > 0);

  function goNext() {
    setStep((s) => Math.min(4, s + 1));
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  function updateDraft(key: string, patch: Partial<Pick<ProductDraft, "name" | "price">>) {
    setDrafts((prev) => ({
      ...prev,
      [selectedTemplate]: (prev[selectedTemplate] ?? []).map((draft) =>
        draft.key === key ? { ...draft, ...patch } : draft,
      ),
    }));
    // Si se edita un producto que falló, regresa a pendiente para reintentar.
    setStatuses((prev) => (prev[key] === "error" ? { ...prev, [key]: "pending" } : prev));
  }

  async function createMenu() {
    if (creating) return;
    setCreating(true);
    try {
      for (const draft of selectedDrafts) {
        if (statuses[draft.key] === "ok") continue;
        if (!isValidDraft(draft)) {
          setStatuses((prev) => ({ ...prev, [draft.key]: "error" }));
          continue;
        }
        setStatuses((prev) => ({ ...prev, [draft.key]: "creating" }));
        try {
          const res = await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Org-Slug": ORG_SLUG },
            body: JSON.stringify({
              name: draft.name.trim(),
              priceCents: priceCentsOf(draft),
              categoryName: draft.categoryName,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setStatuses((prev) => ({ ...prev, [draft.key]: "ok" }));
        } catch {
          setStatuses((prev) => ({ ...prev, [draft.key]: "error" }));
        }
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} media="print" />

      {/* Encabezado + progreso */}
      <header className="space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Configura tu restaurante</h1>
            <p className="text-sm text-muted-foreground">
              Cuatro pasos y estás tomando órdenes — puedes volver cuando quieras.
            </p>
          </div>
          <span className="rounded-full border border-info/20 bg-info/10 px-2.5 py-0.5 text-xs font-medium text-info-text">
            Paso {step} de 4
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="Progreso del onboarding"
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={step}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WIZARD_STEPS.map(({ n, label, icon: Icon }) => {
            const isDone = n < step;
            const isCurrent = n === step;
            return (
              <li key={n} aria-current={isCurrent ? "step" : undefined}>
                <button
                  type="button"
                  onClick={() => setStep(n)}
                  disabled={n >= step}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    isCurrent && "border-primary/40 bg-primary/10 font-medium",
                    isDone && "border-success/20 bg-success/10 text-success-text hover:bg-success/20",
                    !isCurrent && !isDone && "border-border text-muted-foreground",
                    isDone && "cursor-pointer",
                    n >= step && "cursor-default",
                  )}
                >
                  {isDone ? (
                    <Check className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <Icon className="size-4 shrink-0" aria-hidden />
                  )}
                  <span className="truncate">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </header>

      {/* Paso 1 — Tu restaurante */}
      {step === 1 && (
        <div className="print:hidden">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tu restaurante</CardTitle>
              <CardDescription>
                Datos de tu cuenta. Los puedes cambiar después en Configuración.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Nombre del restaurante</p>
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    {org === null && !orgError ? "Cargando…" : orgName}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Moneda</p>
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    {org === null && !orgError ? "Cargando…" : (org?.currency ?? FALLBACK_ORG.currency)}
                  </p>
                </div>
              </div>
              {orgError && (
                <p className="rounded-md border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning-text">
                  No pudimos leer los datos de tu cuenta — mostramos valores de ejemplo. Puedes
                  continuar sin problema.
                </p>
              )}
              <div className="flex justify-end">
                <Button onClick={goNext}>
                  Continuar
                  <ArrowRight aria-hidden />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Paso 2 — Tu menú inicial */}
      {step === 2 && (
        <div className="print:hidden">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tu menú inicial</CardTitle>
              <CardDescription>
                Elige la plantilla de tu cocina — ya trae productos con precios típicos. Edítalos y
                crea tu menú en un clic.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" disabled={creating}>
                <legend className="sr-only">Plantilla por tipo de cocina</legend>
                {TEMPLATES.map((template) => (
                  <label
                    key={template.id}
                    className={cn(
                      "cursor-pointer rounded-xl border p-4 transition-colors",
                      selectedTemplate === template.id
                        ? "border-primary ring-2 ring-primary/30"
                        : "hover:border-muted-foreground/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="plantilla-menu"
                      value={template.id}
                      checked={selectedTemplate === template.id}
                      onChange={() => setSelectedTemplate(template.id)}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                      {template.name}
                      <span
                        aria-hidden
                        className={cn(
                          "size-2 rounded-full",
                          selectedTemplate === template.id ? "bg-primary" : "bg-muted-foreground/30",
                        )}
                      />
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {template.description}
                    </span>
                    <span className="mt-2 block text-xs font-medium text-muted-foreground">
                      {template.items.length} productos sugeridos
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Productos de la plantilla {TEMPLATES.find((t) => t.id === selectedTemplate)?.name}
                </p>
                <ol className="space-y-2">
                  {selectedDrafts.map((draft, index) => {
                    const status = statuses[draft.key] ?? "pending";
                    return (
                      <li
                        key={draft.key}
                        className="flex items-center gap-3 rounded-lg border bg-muted/20 p-2.5"
                      >
                        <ItemStatusIcon status={status} />
                        <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_130px_auto] sm:items-center">
                          <div className="space-y-1">
                            <label
                              htmlFor={`prod-name-${draft.key}`}
                              className="sr-only"
                            >{`Producto ${index + 1} — nombre`}</label>
                            <Input
                              id={`prod-name-${draft.key}`}
                              value={draft.name}
                              onChange={(e) => updateDraft(draft.key, { name: e.target.value })}
                              placeholder="Nombre del producto"
                              disabled={creating || status === "ok"}
                            />
                          </div>
                          <div className="relative space-y-1">
                            <span
                              aria-hidden
                              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                            >
                              $
                            </span>
                            <label htmlFor={`prod-price-${draft.key}`} className="sr-only">
                              {`Producto ${index + 1} — precio en soles`}
                            </label>
                            <Input
                              id={`prod-price-${draft.key}`}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={0.5}
                              className="pl-6 tabular-nums"
                              value={draft.price}
                              onChange={(e) => updateDraft(draft.key, { price: e.target.value })}
                              placeholder="0"
                              disabled={creating || status === "ok"}
                            />
                          </div>
                          <span className="hidden rounded-full border border-info/20 bg-info/10 px-2.5 py-0.5 text-xs font-medium text-info-text sm:inline-block">
                            {draft.categoryName}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {hasInvalid && (
                <p className="rounded-md border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning-text">
                  Hay productos sin nombre o con precio en cero: se van a saltar al crear el menú.
                </p>
              )}

              <div
                aria-live="polite"
                className="text-sm text-muted-foreground"
              >
                {creating
                  ? "Creando tu menú…"
                  : createdCount > 0
                    ? `${createdCount} ${createdCount === 1 ? "producto creado" : "productos creados"} en total.`
                    : "Tus productos se crearán en el menú del panel."}
              </div>

              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="ghost" onClick={goBack}>
                  <ArrowLeft aria-hidden />
                  Atrás
                </Button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={createMenu} disabled={creating || menuDone}>
                    {creating ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <UtensilsCrossed aria-hidden />
                    )}
                    {menuDone ? "Menú creado" : creating ? "Creando tu menú…" : "Crear mi menú"}
                  </Button>
                  <Button variant={menuDone ? "default" : "outline"} onClick={goNext}>
                    Continuar
                    <ArrowRight aria-hidden />
                  </Button>
                </div>
              </div>
              {menuDone && (
                <p className="text-sm text-success-text">
                  Listo, tu menú ya vive en el panel. Sigue con tus QRs.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Paso 3 — Imprime tus QRs (la hoja es lo único que sale en el papel) */}
      {step === 3 && (
        <>
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle className="text-base">Imprime tus QRs</CardTitle>
              <CardDescription>
                Cada mesa escanea su código y ve tu carta al instante. Imprime la hoja, recorta y
                pega un QR en cada mesa — el de la carta va en la entrada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.print()}>
                <Printer aria-hidden />
                Imprimir hoja de QRs
              </Button>
            </CardContent>
          </Card>

          <section id="qr-sheet" aria-label="Hoja de códigos QR para las mesas">
            <div className="mb-4">
              <h2 className="text-lg font-semibold tracking-tight print:text-base">
                Cartas QR — {orgName}
              </h2>
              <p className="text-sm text-muted-foreground">
                Escanea y ordena desde tu mesa · carta completa en {MENU_APP_URL}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 print:grid-cols-3">
              {MESAS.map((mesa) => {
                const url = `${MENU_APP_URL}/?mesa=${mesa}`;
                return (
                  <div
                    key={mesa}
                    className="flex break-inside-avoid flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center shadow-sm print:p-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- SVG del API de QR */}
                    <img
                      src={`/api/qr?data=${encodeURIComponent(url)}`}
                      alt={`Código QR de la mesa ${mesa}`}
                      width={240}
                      height={240}
                      className="size-36 print:size-[140px]"
                    />
                    <p className="text-sm font-semibold">Mesa {mesa}</p>
                    <p className="text-xs text-muted-foreground">Escanea y ordena desde tu mesa</p>
                  </div>
                );
              })}
              <div className="flex break-inside-avoid flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center shadow-sm print:p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- SVG del API de QR */}
                <img
                  src={`/api/qr?data=${encodeURIComponent(`${MENU_APP_URL}/`)}`}
                  alt="Código QR de la carta digital"
                  width={240}
                  height={240}
                  className="size-36 print:size-[140px]"
                />
                <p className="text-sm font-semibold">Carta digital</p>
                <p className="text-xs text-muted-foreground">El menú completo, en la entrada</p>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-2 border-t pt-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={goBack}>
              <ArrowLeft aria-hidden />
              Atrás
            </Button>
            <Button variant="outline" onClick={goNext}>
              Continuar
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </>
      )}

      {/* Paso 4 — Invita a tu equipo + resumen */}
      {step === 4 && (
        <div className="print:hidden space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invita a tu equipo</CardTitle>
              <CardDescription>
                Dale acceso a tus primeros meseros y cocineros. En esta demo quedan guardados como
                ejemplo; después los administras desde la sección Staff.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {employees.map((employee, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[1fr_180px] sm:items-end"
                >
                  <div className="space-y-1.5">
                    <label htmlFor={`emp-name-${index}`} className="text-sm font-medium">
                      {index === 0 ? "Nombre del primer empleado" : "Nombre del segundo empleado"}
                    </label>
                    <Input
                      id={`emp-name-${index}`}
                      value={employee.name}
                      onChange={(e) =>
                        setEmployees((prev) =>
                          prev.map((emp, i) =>
                            i === index ? { ...emp, name: e.target.value } : emp,
                          ),
                        )
                      }
                      placeholder={index === 0 ? "Ej. Carlos Méndez" : "Ej. Ana García"}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`emp-role-${index}`} className="text-sm font-medium">
                      Rol
                    </label>
                    <select
                      id={`emp-role-${index}`}
                      value={employee.role}
                      onChange={(e) =>
                        setEmployees((prev) =>
                          prev.map((emp, i) =>
                            i === index ? { ...emp, role: e.target.value } : emp,
                          ),
                        )
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen de tu setup</CardTitle>
              <CardDescription>Esto es lo que quedó listo para tu primer servicio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                {
                  done: true,
                  label: "Restaurante configurado",
                  value: `${orgName} · ${org?.currency ?? FALLBACK_ORG.currency}`,
                },
                {
                  done: createdCount > 0,
                  label: "Menú inicial",
                  value:
                    createdCount > 0
                      ? `${createdCount} ${createdCount === 1 ? "producto creado" : "productos creados"}`
                      : "Pendiente — puedes cargarlo desde la sección Menú",
                },
                {
                  done: true,
                  label: "QRs para mesas",
                  value: "6 mesas + carta digital, listos para imprimir",
                },
                {
                  done: invitedNames.length > 0,
                  label: "Equipo invitado",
                  value:
                    invitedNames.length > 0
                      ? invitedNames.join(" · ")
                      : "Sin invitaciones — hazlo después desde Staff",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 text-sm"
                >
                  {item.done ? (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success/10 text-success-text">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                  ) : (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-warning/10">
                      <span className="size-2 rounded-full bg-warning" aria-hidden />
                    </span>
                  )}
                  <span className="font-medium">{item.label}</span>
                  <span
                    className={cn(
                      "ml-auto text-right text-xs sm:text-sm",
                      item.done ? "text-muted-foreground" : "text-warning-text",
                    )}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/" className={buttonVariants({ size: "lg" })}>
              Ir al panel
            </Link>
            <Link
              href={POS_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <ExternalLink aria-hidden />
              Abrir POS de demo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
