"use client";

/**
 * Pestaña Vender: catálogo por categorías + cuenta (carrito) con modificadores
 * obligatorios, nota por producto, descuento rápido con confirmación, mesa
 * real del bootstrap y acciones "Enviar a cocina" / "Cobrar".
 */
import { Percent, Send, Trash2, X } from "lucide-react";
import { useEffect, useState, type Dispatch } from "react";
import { formatMoney } from "@rest/printer";
import { Button, Input, cn } from "@rest/ui";
import type { Category, Modifier, Product } from "@rest/types";
import type { PosTable } from "@/lib/api";
import {
  cartUnitPriceCents,
  type CartAction,
  type CartItem,
} from "@/lib/pos-types";

const DISCOUNT_OPTIONS = [0, 5, 10] as const;

interface SellTabProps {
  categories: Category[];
  products: Product[];
  tables: PosTable[];
  table: string;
  onTableChange: (table: string) => void;
  cart: CartItem[];
  dispatch: Dispatch<CartAction>;
  discountPct: number;
  onDiscountChange: (pct: number) => void;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  sending: boolean;
  onSend: () => void;
  onCharge: () => void;
}

interface SelectedGroups {
  [groupId: string]: Modifier[];
}

export function SellTab({
  categories,
  products,
  tables,
  table,
  onTableChange,
  cart,
  dispatch,
  discountPct,
  onDiscountChange,
  subtotalCents,
  discountCents,
  totalCents,
  sending,
  onSend,
  onCharge,
}: SellTabProps) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [picking, setPicking] = useState<Product | null>(null);
  const [selected, setSelected] = useState<SelectedGroups>({});
  const [confirmPct, setConfirmPct] = useState<number | null>(null);
  /** En móvil (< lg) la cuenta vive en un drawer; el botón flotante lo abre. */
  const [cartOpen, setCartOpen] = useState(false);

  // Si el catálogo cambia (bootstrap en vivo), re-ancla la categoría activa.
  useEffect(() => {
    if (!categories.some((category) => category.id === activeCategory)) {
      setActiveCategory(categories[0]?.id ?? "");
    }
  }, [categories, activeCategory]);

  const visible = products.filter((p) => p.categoryId === activeCategory);

  function addProduct(product: Product) {
    if (!product.available) return;
    if (product.modifierGroups.length > 0) {
      setPicking(product);
      setSelected({});
      return;
    }
    dispatch({ type: "add", product, modifiers: [] });
  }

  const pickingGroups = picking?.modifierGroups ?? [];
  const canAddPicker =
    pickingGroups.every(
      (group) =>
        !group.required || (selected[group.id]?.length ?? 0) >= group.minSelect,
    ) && pickingGroups.length > 0;

  return (
    <div className="relative flex h-full min-h-0">
      {/* Catálogo */}
      <section className="flex min-w-0 flex-1 flex-col border-r">
        <div className="flex gap-2 overflow-x-auto border-b p-2">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                "h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
                activeCategory === category.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-2 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => addProduct(product)}
              disabled={!product.available}
              className={cn(
                "flex min-h-24 flex-col items-start justify-between rounded-xl border-2 p-3 text-left transition-colors",
                product.available
                  ? "border-border bg-card hover:border-primary hover:bg-primary/5"
                  : "cursor-not-allowed border-dashed border-border bg-muted text-muted-foreground line-through",
              )}
            >
              <span className="text-base font-semibold leading-tight">
                {product.name}
              </span>
              <span className="text-sm font-bold text-primary">
                {formatMoney(product.priceCents)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Cuenta: drawer en móvil (< lg), columna fija en desktop */}
      {cartOpen && (
        <div
          role="presentation"
          className="absolute inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setCartOpen(false)}
        />
      )}
      <aside
        className={cn(
          "absolute inset-y-0 right-0 z-30 flex w-80 max-w-[88vw] flex-col bg-muted/40 shadow-xl transition-transform duration-200",
          "lg:static lg:z-auto lg:w-96 lg:shrink-0 lg:translate-x-0 lg:shadow-none",
          cartOpen ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!cartOpen}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <button
            type="button"
            aria-label="Cerrar cuenta"
            onClick={() => setCartOpen(false)}
            className="flex size-10 shrink-0 items-center justify-center rounded-md border hover:bg-muted lg:hidden"
          >
            <X className="size-4" />
          </button>
          <select
            value={table}
            onChange={(event) => onTableChange(event.target.value)}
            aria-label="Mesa"
            className="h-10 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm font-medium"
          >
            {tables.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
                {t.zone ? ` · ${t.zone}` : ""}
              </option>
            ))}
          </select>
          {cart.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-10 shrink-0 px-2"
              onClick={() => dispatch({ type: "clear" })}
            >
              <Trash2 className="size-4" />
              <span className="hidden lg:inline">Vaciar</span>
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {cart.length === 0 && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Toca un producto para agregarlo
            </p>
          )}
          {cart.map((item) => (
            <div key={item.key} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.quantity}× {item.product.name}
                  </p>
                  {item.modifiers.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {item.modifiers.map((m) => m.name).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Quitar uno"
                    className="size-9 rounded-md border text-lg leading-none hover:bg-muted"
                    onClick={() => dispatch({ type: "dec", key: item.key })}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    aria-label="Agregar uno"
                    className="size-9 rounded-md border text-lg leading-none hover:bg-muted"
                    onClick={() => dispatch({ type: "inc", key: item.key })}
                  >
                    +
                  </button>
                </div>
              </div>
              <Input
                value={item.notes ?? ""}
                onChange={(event) =>
                  dispatch({ type: "setNote", key: item.key, notes: event.target.value })
                }
                placeholder="Nota para cocina… (ej. sin picante)"
                className="mt-2 h-8 text-xs"
                maxLength={120}
              />
              <p className="mt-1 text-right text-sm font-semibold tabular-nums">
                {formatMoney(cartUnitPriceCents(item) * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t bg-card p-4">
          {/* Descuento rápido */}
          <div className="flex items-center gap-2">
            <Percent className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Descuento:
            </span>
            {DISCOUNT_OPTIONS.map((pct) => (
              <button
                key={pct}
                type="button"
                aria-pressed={discountPct === pct}
                onClick={() => (pct === 0 ? onDiscountChange(0) : setConfirmPct(pct))}
                className={cn(
                  "h-9 min-w-12 rounded-full border-2 px-2 text-xs font-semibold transition-colors",
                  discountPct === pct
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary",
                )}
              >
                {pct}%
              </button>
            ))}
            {discountCents > 0 && (
              <span className="ml-auto text-xs font-semibold tabular-nums text-success-text">
                −{formatMoney(discountCents)}
              </span>
            )}
          </div>

          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatMoney(subtotalCents)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>TOTAL</span>
            <span className="tabular-nums">{formatMoney(totalCents)}</span>
          </div>
          <Button
            size="lg"
            className="h-14 w-full text-base"
            disabled={cart.length === 0 || sending}
            onClick={onSend}
          >
            <Send className="size-5" />
            {sending ? "Enviando…" : "Enviar a cocina"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 w-full text-base"
            disabled={cart.length === 0 || sending}
            onClick={onCharge}
          >
            Cobrar · {formatMoney(totalCents)}
          </Button>
        </div>
      </aside>

      {/* Botón flotante móvil: abre la cuenta con el total a la vista */}
      {cart.length > 0 && !cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="absolute inset-x-3 bottom-3 z-20 flex h-14 items-center justify-between rounded-2xl bg-primary px-4 text-primary-foreground shadow-lg lg:hidden"
        >
          <span className="text-sm font-semibold">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} en la cuenta
          </span>
          <span className="text-base font-bold tabular-nums">
            Ver cuenta · {formatMoney(totalCents)}
          </span>
        </button>
      )}

      {/* Modal de modificadores (regla: grupos requeridos con min/max selects) */}
      {picking && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[86dvh] w-full max-w-md overflow-y-auto rounded-xl border bg-card p-4 shadow-lg">
            <h3 className="text-lg font-semibold">{picking.name}</h3>
            {pickingGroups.map((group) => {
              const picks = selected[group.id] ?? [];
              const maxed = picks.length >= group.maxSelect;
              return (
                <div key={group.id} className="mt-3">
                  <p className="text-sm font-medium">
                    {group.name}
                    {group.required && (
                      <span className="ml-1 text-xs font-semibold text-warning-text">
                        obligatorio
                      </span>
                    )}
                    <span className="ml-1 text-xs text-muted-foreground">
                      (hasta {group.maxSelect})
                    </span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.modifiers.map((modifier) => {
                      const active = picks.some((s) => s.id === modifier.id);
                      return (
                        <button
                          key={modifier.id}
                          type="button"
                          disabled={maxed && !active}
                          onClick={() =>
                            setSelected((prev) => {
                              const current = prev[group.id] ?? [];
                              const next = current.some((s) => s.id === modifier.id)
                                ? current.filter((s) => s.id !== modifier.id)
                                : [...current, modifier];
                              return { ...prev, [group.id]: next };
                            })
                          }
                          className={cn(
                            "rounded-full border-2 px-4 py-2.5 text-sm font-medium transition-colors",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary",
                            maxed && !active && "cursor-not-allowed opacity-40",
                          )}
                        >
                          {modifier.name}
                          {modifier.priceCents > 0 && ` +${formatMoney(modifier.priceCents)}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPicking(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={!canAddPicker}
                onClick={() => {
                  const modifiers = Object.values(selected).flat();
                  dispatch({ type: "add", product: picking, modifiers });
                  setPicking(null);
                }}
              >
                Agregar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de descuento */}
      {confirmPct != null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border bg-card p-4 shadow-lg">
            <h3 className="text-base font-semibold">
              ¿Aplicar {confirmPct}% de descuento?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Se descontarán{" "}
              <span className="font-semibold text-success-text">
                −{formatMoney(Math.round((subtotalCents * confirmPct) / 100))}
              </span>{" "}
              de la cuenta.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmPct(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  onDiscountChange(confirmPct);
                  setConfirmPct(null);
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
