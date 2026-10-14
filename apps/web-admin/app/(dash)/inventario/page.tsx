"use client";

import {
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  PackagePlus,
  PackageSearch,
  RefreshCw,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, Input } from "@rest/ui";
import { formatMoney } from "@rest/printer";
import { ORG_SLUG } from "@/lib/use-api";
import { ESTADO_STOCK_META, INSUMOS, estadoStock, fmtCantidad, type EstadoStock } from "./data";

// ── Contrato de la API real ─────────────────────────────────────────────────
// GET   /api/ingredients → { ingredients, recipes }
// PATCH /api/ingredients { id, stockQty }
// POST  /api/ingredients { name, unit, minQty, costPerUnitCents }
// POST  /api/recipes     { productId, items }

interface IngredientApi {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  minQty: number;
  costPerUnitCents: number;
}

interface RecipeItemApi {
  ingredientId: string;
  name: string;
  unit: string;
  qty: number;
  costCents: number;
}

interface RecipeRowApi {
  productId: string;
  name: string;
  priceCents: number;
  costCents: number;
  marginPct: number;
  items: RecipeItemApi[];
}

interface IngredientsPayload {
  ingredients: IngredientApi[];
  recipes: RecipeRowApi[];
}

const ORG_HEADERS = { "X-Org-Slug": ORG_SLUG } as const;

const UNIDADES = ["kg", "l", "pza"] as const;
type Unidad = (typeof UNIDADES)[number];

// ── Fallback demo (misma forma que la API, calculado con la misma fórmula) ──

type RecipeDraft = {
  productId: string;
  name: string;
  priceCents: number;
  items: Array<{ ingredientId: string; qty: number }>;
};

/** Recalcula costo y margen igual que el servidor: Σ qty × costo unitario. */
function recalcularReceta(
  draft: RecipeDraft,
  ingredientes: IngredientApi[],
): RecipeRowApi {
  const items: RecipeItemApi[] = draft.items.map((it) => {
    const ing = ingredientes.find((i) => i.id === it.ingredientId);
    return {
      ingredientId: it.ingredientId,
      name: ing?.name ?? "?",
      unit: ing?.unit ?? "?",
      qty: it.qty,
      costCents: Math.round(it.qty * (ing?.costPerUnitCents ?? 0)),
    };
  });
  const costCents = items.reduce((acc, i) => acc + i.costCents, 0);
  const marginPct = draft.priceCents > 0 ? Math.round(((draft.priceCents - costCents) / draft.priceCents) * 100) : 0;
  return { productId: draft.productId, name: draft.name, priceCents: draft.priceCents, costCents, marginPct, items };
}

const FALLBACK_INGREDIENTS: IngredientApi[] = INSUMOS.map((i) => ({
  id: i.id,
  name: i.nombre,
  unit: i.unidad,
  stockQty: i.stock,
  minQty: i.minimo,
  costPerUnitCents: i.costoUnitarioCents,
}));

const RECIPE_DRAFTS: RecipeDraft[] = [
  {
    productId: "p1",
    name: "Ceviche de pescado",
    priceCents: 9_500,
    items: [
      { ingredientId: "i1", qty: 3 },
      { ingredientId: "i2", qty: 0.15 },
      { ingredientId: "i6", qty: 0.02 },
    ],
  },
  {
    productId: "p2",
    name: "Ceviche mixto",
    priceCents: 12_000,
    items: [
      { ingredientId: "i1", qty: 3 },
      { ingredientId: "i2", qty: 0.16 },
      { ingredientId: "i3", qty: 0.06 },
    ],
  },
  {
    productId: "p3",
    name: "Ceviche de camarones",
    priceCents: 6_500,
    items: [
      { ingredientId: "i4", qty: 0.2 },
      { ingredientId: "i1", qty: 4 },
    ],
  },
];

const FALLBACK_PAYLOAD: IngredientsPayload = {
  ingredients: FALLBACK_INGREDIENTS,
  recipes: RECIPE_DRAFTS.map((d) => recalcularReceta(d, FALLBACK_INGREDIENTS)),
};

// ── Piezas de UI ────────────────────────────────────────────────────────────

type Banner = { kind: "success" | "warning"; text: string };

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function ModalShell({
  titulo,
  descripcion,
  onClose,
  children,
}: {
  titulo: string;
  descripcion: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={titulo}>
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-4 top-1/2 mx-auto max-h-[90dvh] max-w-md -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-6 shadow-xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
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

function Kpi({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

// ── Modal: conteo rápido (PATCH /api/ingredients) ───────────────────────────

function ConteoModal({
  ingrediente,
  onClose,
  onSave,
}: {
  ingrediente: IngredientApi;
  onClose: () => void;
  onSave: (conteo: number) => void;
}) {
  const [valor, setValor] = useState("");

  const parsed = Number.parseFloat(valor.replace(",", "."));
  const valido = Number.isFinite(parsed) && parsed >= 0;

  return (
    <ModalShell
      titulo="Conteo rápido"
      descripcion={`Captura lo que hay físicamente de ${ingrediente.name}.`}
      onClose={onClose}
    >
      <div className="mt-4 space-y-1.5">
        <label htmlFor="conteo-valor" className="text-xs font-medium text-muted-foreground">
          Cantidad contada ({ingrediente.unit}) — sistema: {fmtCantidad(ingrediente.stockQty)} {ingrediente.unit}
        </label>
        <Input
          id="conteo-valor"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={String(ingrediente.stockQty)}
        />
        {valido && parsed !== ingrediente.stockQty && (
          <p className="text-xs text-muted-foreground">
            Ajuste: {fmtCantidad(ingrediente.stockQty)} → {fmtCantidad(parsed)} {ingrediente.unit}
          </p>
        )}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={!valido} onClick={() => onSave(parsed)}>
          Guardar conteo
        </Button>
      </div>
    </ModalShell>
  );
}

// ── Modal: agregar insumo (POST /api/ingredients) ───────────────────────────

function NuevoInsumoModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (payload: { name: string; unit: Unidad; minQty: number; costPerUnitCents: number }) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState<Unidad>("kg");
  const [minimo, setMinimo] = useState("");
  const [costo, setCosto] = useState("");

  const minQty = Number.parseFloat(minimo.replace(",", "."));
  const costoSoles = Number.parseFloat(costo.replace(",", "."));
  const valido = nombre.trim().length > 0 && Number.isFinite(minQty) && minQty >= 0 && Number.isFinite(costoSoles) && costoSoles >= 0;

  return (
    <ModalShell titulo="Agregar insumo" descripcion="Se usa en el escandallo y baja con cada venta." onClose={onClose}>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="insumo-nombre" className="text-xs font-medium text-muted-foreground">
            Nombre del insumo
          </label>
          <Input
            id="insumo-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Carne de suadero"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="insumo-unidad" className="text-xs font-medium text-muted-foreground">
              Unidad
            </label>
            <select
              id="insumo-unidad"
              value={unidad}
              onChange={(e) => setUnidad(e.target.value as Unidad)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {UNIDADES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="insumo-minimo" className="text-xs font-medium text-muted-foreground">
              Stock mínimo
            </label>
            <Input
              id="insumo-minimo"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={minimo}
              onChange={(e) => setMinimo(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="insumo-costo" className="text-xs font-medium text-muted-foreground">
            Costo por unidad (PEN)
          </label>
          <Input
            id="insumo-costo"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={!valido}
          onClick={() => onSave({ name: nombre.trim(), unit: unidad, minQty, costPerUnitCents: Math.round(costoSoles * 100) })}
        >
          Agregar insumo
        </Button>
      </div>
    </ModalShell>
  );
}

// ── Modal: definir receta (POST /api/recipes — reemplaza la receta completa) ─

function RecetaModal({
  producto,
  ingredientes,
  onClose,
  onSave,
}: {
  producto: RecipeRowApi;
  ingredientes: IngredientApi[];
  onClose: () => void;
  onSave: (items: RecipeItemApi[]) => void;
}) {
  const [items, setItems] = useState<RecipeItemApi[]>(producto.items);
  const [ingredienteId, setIngredienteId] = useState(ingredientes[0]?.id ?? "");
  const [qty, setQty] = useState("");

  const qtyNum = Number.parseFloat(qty.replace(",", "."));
  const puedoAgregar = ingredienteId !== "" && Number.isFinite(qtyNum) && qtyNum > 0 && !items.some((i) => i.ingredientId === ingredienteId);

  const agregar = () => {
    if (!puedoAgregar) return;
    const ing = ingredientes.find((i) => i.id === ingredienteId);
    if (!ing) return;
    setItems((prev) => [...prev, { ingredientId: ing.id, name: ing.name, unit: ing.unit, qty: qtyNum, costCents: Math.round(qtyNum * ing.costPerUnitCents) }]);
    setQty("");
  };

  return (
    <ModalShell
      titulo={`Receta de ${producto.name}`}
      descripcion="Al guardar se reemplaza la receta completa y el escandallo se recalcula."
      onClose={onClose}
    >
      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          <ul className="space-y-1.5">
            {items.map((i) => (
              <li key={i.ingredientId} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{i.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {fmtCantidad(i.qty)} {i.unit}
                </span>
                <span className="w-20 text-right tabular-nums">{formatMoney(i.costCents)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Quitar ${i.name} de la receta`}
                  onClick={() => setItems((prev) => prev.filter((x) => x.ingredientId !== i.ingredientId))}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Sin insumos todavía: agrega al menos uno para que el margen sea real.
          </p>
        )}

        <div className="grid grid-cols-[1fr_96px_auto] items-end gap-2">
          <div className="space-y-1.5">
            <label htmlFor="receta-insumo" className="text-xs font-medium text-muted-foreground">
              Insumo
            </label>
            <select
              id="receta-insumo"
              value={ingredienteId}
              onChange={(e) => setIngredienteId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ingredientes.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="receta-qty" className="text-xs font-medium text-muted-foreground">
              Cantidad
            </label>
            <Input
              id="receta-qty"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
            />
          </div>
          <Button variant="outline" disabled={!puedoAgregar} onClick={agregar}>
            <PackagePlus aria-hidden />
            Agregar
          </Button>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={items.length === 0} onClick={() => onSave(items)}>
          Guardar receta
        </Button>
      </div>
    </ModalShell>
  );
}

// ── Meta de margen (F4): ≥60 success · 40-60 warning · <40 danger ───────────

function margenVariant(pct: number): "success" | "warning" | "danger" {
  if (pct >= 60) return "success";
  if (pct >= 40) return "warning";
  return "danger";
}

// ── Página ──────────────────────────────────────────────────────────────────

export default function InventarioPage() {
  const [data, setData] = useState<IngredientsPayload>({ ingredients: [], recipes: [] });
  const [source, setSource] = useState<"loading" | "live" | "demo">("loading");
  const [refrescando, setRefrescando] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [conteo, setConteo] = useState<IngredientApi | null>(null);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [recetaDe, setRecetaDe] = useState<RecipeRowApi | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefrescando(true);
    try {
      const res = await fetch("/api/ingredients", { headers: ORG_HEADERS, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as IngredientsPayload;
      setData({ ingredients: payload.ingredients ?? [], recipes: payload.recipes ?? [] });
      setSource("live");
    } catch {
      setData({ ingredients: [], recipes: [] });
      setSource("demo");
    } finally {
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // PATCH /api/ingredients { id, stockQty } — sin conexión queda solo en local.
  const guardarConteo = async (ingrediente: IngredientApi, valor: number) => {
    try {
      const res = await fetch("/api/ingredients", {
        method: "PATCH",
        headers: { ...ORG_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ id: ingrediente.id, stockQty: valor }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConteo(null);
      setBanner({
        kind: "success",
        text: `Conteo guardado: ${ingrediente.name} ahora con ${fmtCantidad(valor)} ${ingrediente.unit}.`,
      });
      void refresh();
    } catch {
      setData((prev) => ({
        ...prev,
        ingredients: prev.ingredients.map((i) => (i.id === ingrediente.id ? { ...i, stockQty: valor } : i)),
      }));
      setConteo(null);
      setBanner({
        kind: "warning",
        text: `Sin conexión con la API: el conteo de ${ingrediente.name} se aplicó solo en local (demo).`,
      });
    }
  };

  // POST /api/ingredients — alta de insumo.
  const crearInsumo = async (payload: { name: string; unit: Unidad; minQty: number; costPerUnitCents: number }) => {
    try {
      const res = await fetch("/api/ingredients", {
        method: "POST",
        headers: { ...ORG_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNuevoOpen(false);
      setBanner({ kind: "success", text: `Insumo ${payload.name} agregado al inventario.` });
      void refresh();
    } catch {
      setData((prev) => ({
        ...prev,
        ingredients: [...prev.ingredients, { id: `local-${Date.now()}`, stockQty: 0, ...payload }],
      }));
      setNuevoOpen(false);
      setBanner({ kind: "warning", text: `Sin conexión con la API: ${payload.name} se agregó solo en local (demo).` });
    }
  };

  // POST /api/recipes { productId, items } — reemplaza la receta completa.
  const guardarReceta = async (producto: RecipeRowApi, items: RecipeItemApi[]) => {
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { ...ORG_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: producto.productId,
          items: items.map((i) => ({ ingredientId: i.ingredientId, qty: i.qty })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRecetaDe(null);
      setBanner({ kind: "success", text: `Receta de ${producto.name} actualizada · escandallo recalculado.` });
      void refresh();
    } catch {
      setData((prev) => ({
        ...prev,
        recipes: prev.recipes.map((r) =>
          r.productId === producto.productId
            ? recalcularReceta(
                {
                  productId: producto.productId,
                  name: producto.name,
                  priceCents: producto.priceCents,
                  items: items.map((i) => ({ ingredientId: i.ingredientId, qty: i.qty })),
                },
                prev.ingredients,
              )
            : r,
        ),
      }));
      setRecetaDe(null);
      setBanner({
        kind: "warning",
        text: `Sin conexión con la API: la receta de ${producto.name} se actualizó solo en local (demo).`,
      });
    }
  };

  const { ingredients, recipes } = data;
  const enRiesgo = ingredients.filter((i) => estadoStock(i.stockQty, i.minQty) !== "ok");
  const criticos = enRiesgo.filter((i) => estadoStock(i.stockQty, i.minQty) === "critico").length;
  const costoTotal = ingredients.reduce((acc, i) => acc + i.stockQty * i.costPerUnitCents, 0);
  const conReceta = recipes.filter((r) => r.items.length > 0);
  const margenPromedio =
    conReceta.length > 0
      ? Math.round(conReceta.reduce((acc, r) => acc + r.marginPct, 0) / conReceta.length)
      : null;
  const margenBajo = conReceta.filter((r) => r.marginPct < 40).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Inventario</h1>
          <p className="text-sm text-muted-foreground">
            Insumos, mínimos y alertas · escandallo y margen por producto (F4)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {source === "live" && (
            <Badge variant="success">
              <span className="size-1.5 rounded-full bg-success" aria-hidden /> en vivo
            </Badge>
          )}
          {source === "demo" && (
            <Badge variant="warning">
              <span className="size-1.5 rounded-full bg-warning" aria-hidden /> demo
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => void refresh()} aria-label="Refrescar datos del inventario">
            <RefreshCw className={refrescando ? "animate-spin" : undefined} aria-hidden />
            Actualizar
          </Button>
        </div>
      </div>

      {banner && (
        <div
          role="status"
          className={
            banner.kind === "success"
              ? "flex items-center justify-between gap-3 rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success-text"
              : "flex items-center justify-between gap-3 rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning-text"
          }
        >
          <span>{banner.text}</span>
          <Button variant="ghost" size="icon" onClick={() => setBanner(null)} aria-label="Descartar aviso">
            <X />
          </Button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        <Kpi
          label="Insumos en riesgo"
          value={String(enRiesgo.length)}
          hint={`${criticos} críticos · ${enRiesgo.length - criticos} bajos`}
          icon={<PackageSearch className="size-4 text-primary" aria-hidden />}
        />
        <Kpi
          label="Costo del inventario"
          value={formatMoney(Math.round(costoTotal))}
          hint={`${ingredients.length} insumos activos`}
          icon={<ClipboardCheck className="size-4 text-primary" aria-hidden />}
        />
        <Kpi
          label="Margen promedio (escandallo)"
          value={margenPromedio !== null ? `${margenPromedio}%` : "—"}
          hint={margenBajo > 0 ? `${margenBajo} productos con margen bajo` : `${conReceta.length} productos con receta`}
          icon={<UtensilsCrossed className="size-4 text-primary" aria-hidden />}
        />
      </div>

      {/* ── Insumos ── */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <div>
            <h2 className="text-sm font-semibold">Insumos</h2>
            <p className="text-xs text-muted-foreground">Mínimos y estado calculado: bajo al llegar al mínimo, crítico a la mitad.</p>
          </div>
          <Button size="sm" onClick={() => setNuevoOpen(true)}>
            <PackagePlus aria-hidden />
            Agregar insumo
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Insumo</th>
                <th className="px-4 py-3 font-medium">Unidad</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Mínimo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Sin insumos todavía. Agrega el primero para empezar a contar.
                  </td>
                </tr>
              )}
              {ingredients.map((i) => {
                const estado: EstadoStock = estadoStock(i.stockQty, i.minQty);
                const meta = ESTADO_STOCK_META[estado];
                return (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {i.name}
                      <span className="block text-xs font-normal text-muted-foreground">{formatMoney(i.costPerUnitCents)} / {i.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{i.unit}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtCantidad(i.stockQty)}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{fmtCantidad(i.minQty)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={meta.badge}>
                        <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden />
                        {meta.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setConteo(i)}>
                        Contar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Escandallo y margen (F4) ── */}
      <Card className="overflow-hidden">
        <div className="border-b p-4">
          <h2 className="text-sm font-semibold">Escandallo y margen</h2>
          <p className="text-xs text-muted-foreground">
            Costo teórico por producto (Σ insumo × costo) vs precio de venta. Expande una fila para ver la receta.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 text-right font-medium">Precio</th>
                <th className="px-4 py-3 text-right font-medium">Costo teórico</th>
                <th className="px-4 py-3 font-medium">Margen</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {recipes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Sin productos con receta todavía.
                  </td>
                </tr>
              )}
              {recipes.map((r) => {
                const abierto = expandido === r.productId;
                return (
                  <Fragment key={r.productId}>
                    <tr className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          aria-expanded={abierto}
                          aria-label={`${abierto ? "Ocultar" : "Ver"} receta de ${r.name}`}
                          onClick={() => setExpandido(abierto ? null : r.productId)}
                          className="flex cursor-pointer items-center gap-1.5 text-left font-medium hover:text-primary"
                        >
                          {abierto ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                          {r.name}
                        </button>
                        <span className="ml-[22px] block text-xs text-muted-foreground">{r.items.length} insumos en receta</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatMoney(r.priceCents)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatMoney(r.costCents)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={margenVariant(r.marginPct)}>{r.marginPct}%</Badge>
                          <div
                            className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-valuenow={r.marginPct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Margen de ${r.name}: ${r.marginPct}%`}
                          >
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(0, Math.min(100, r.marginPct))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => setRecetaDe(r)}>
                          Definir receta
                        </Button>
                      </td>
                    </tr>
                    {abierto && (
                      <tr className="border-b bg-muted/20">
                        <td colSpan={5} className="px-4 py-3">
                          <table className="w-full max-w-xl text-xs">
                            <thead>
                              <tr className="text-left text-muted-foreground">
                                <th className="py-1 font-medium">Insumo</th>
                                <th className="py-1 text-right font-medium">Cantidad</th>
                                <th className="py-1 text-right font-medium">Costo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.items.map((it) => (
                                <tr key={it.ingredientId} className="border-t border-border/60">
                                  <td className="py-1.5">{it.name}</td>
                                  <td className="py-1.5 text-right tabular-nums">
                                    {fmtCantidad(it.qty)} {it.unit}
                                  </td>
                                  <td className="py-1.5 text-right tabular-nums">{formatMoney(it.costCents)}</td>
                                </tr>
                              ))}
                              <tr className="border-t border-border/60">
                                <td className="py-1.5 font-medium">Costo teórico total</td>
                                <td />
                                <td className="py-1.5 text-right font-semibold tabular-nums">{formatMoney(r.costCents)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        El stock baja automáticamente con cada venta del POS; el conteo rápido corrige diferencias contra la API. El
        escandallo recalcula el margen al guardar la receta: ≥60% saludable, 40–60% ajustado, &lt;40% bajo.
      </p>

      {conteo && (
        <ConteoModal
          key={conteo.id}
          ingrediente={conteo}
          onClose={() => setConteo(null)}
          onSave={(valor) => void guardarConteo(conteo, valor)}
        />
      )}

      {nuevoOpen && (
        <NuevoInsumoModal onClose={() => setNuevoOpen(false)} onSave={(payload) => void crearInsumo(payload)} />
      )}

      {recetaDe && (
        <RecetaModal
          key={recetaDe.productId}
          producto={recetaDe}
          ingredientes={ingredients}
          onClose={() => setRecetaDe(null)}
          onSave={(items) => void guardarReceta(recetaDe, items)}
        />
      )}
    </div>
  );
}
