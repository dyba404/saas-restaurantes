"use client";

import { Camera, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Input, cn } from "@rest/ui";
import { moneyExact } from "@/lib/format";
import {
  ALLERGENS,
  GRADIENTES_NUEVO,
  LANGUAGES,
  MENU_CATEGORIES,
  MENU_ITEMS,
  centsToSolesInput,
  solesToCents,
  type Language,
  type MenuItem,
  type ModifierGroup,
  type Translation,
} from "./data";

// ── Borrador del editor (precio/modificadores como texto mientras se edita) ──

interface DraftModifier {
  id: string;
  name: string;
  /** Precio extra en soles, texto libre. */
  priceInput: string;
}

interface DraftGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  modifiers: DraftModifier[];
}

interface Draft {
  id: string;
  name: string;
  description: string;
  category: string;
  priceInput: string;
  available: boolean;
  active: boolean;
  allergens: string[];
  gradient: string;
  translations: { en: Translation; pt: Translation };
  groups: DraftGroup[];
}

function toDraft(item: MenuItem): Draft {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    priceInput: centsToSolesInput(item.priceCents),
    available: item.available,
    active: item.active,
    allergens: [...item.allergens],
    gradient: item.gradient,
    translations: {
      en: { ...item.translations.en },
      pt: { ...item.translations.pt },
    },
    groups: item.modifierGroups.map((g) => ({
      id: g.id,
      name: g.name,
      required: g.required,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      modifiers: g.modifiers.map((m) => ({ id: m.id, name: m.name, priceInput: centsToSolesInput(m.priceCents) })),
    })),
  };
}

function newDraft(itemCount: number): Draft {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    category: MENU_CATEGORIES[0],
    priceInput: "",
    available: true,
    active: true,
    allergens: [],
    gradient: GRADIENTES_NUEVO[itemCount % GRADIENTES_NUEVO.length],
    translations: {
      en: { name: "", description: "" },
      pt: { name: "", description: "" },
    },
    groups: [],
  };
}

function toItem(draft: Draft): MenuItem {
  const groups: ModifierGroup[] = draft.groups.map((g) => ({
    id: g.id,
    name: g.name.trim() || "Grupo sin nombre",
    required: g.required,
    minSelect: g.minSelect,
    maxSelect: Math.max(g.maxSelect, g.minSelect),
    modifiers: g.modifiers.map((m) => ({
      id: m.id,
      name: m.name.trim() || "Modificador",
      priceCents: solesToCents(m.priceInput),
    })),
  }));
  const es: Translation = { name: draft.name.trim(), description: draft.description.trim() };
  return {
    id: draft.id,
    name: es.name,
    description: es.description,
    category: draft.category,
    priceCents: solesToCents(draft.priceInput),
    available: draft.available,
    active: draft.active,
    allergens: draft.allergens,
    gradient: draft.gradient,
    translations: { es, en: draft.translations.en, pt: draft.translations.pt },
    modifierGroups: groups,
  };
}

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

/** Interruptor suave: pista gris cuando está apagado, primario cuando encendido. */
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
          className={cn(
            "size-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </span>
      {label}
    </button>
  );
}

function ProductEditor({
  item,
  isNew,
  onClose,
  onSave,
}: {
  item: Draft;
  isNew: boolean;
  onClose: () => void;
  onSave: (item: MenuItem) => void;
}) {
  const [draft, setDraft] = useState<Draft>(item);
  const [lang, setLang] = useState<Language>("es");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSave = draft.name.trim().length > 0 && solesToCents(draft.priceInput) > 0;

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const patchGroup = (gid: string, p: Partial<DraftGroup>) =>
    setDraft((d) => ({ ...d, groups: d.groups.map((g) => (g.id === gid ? { ...g, ...p } : g)) }));

  const patchTranslation = (code: "en" | "pt", p: Partial<Translation>) =>
    setDraft((d) => ({ ...d, translations: { ...d.translations, [code]: { ...d.translations[code], ...p } } }));

  const addGroup = () =>
    setDraft((d) => ({
      ...d,
      groups: [
        ...d.groups,
        {
          id: crypto.randomUUID(),
          name: "",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          modifiers: [{ id: crypto.randomUUID(), name: "", priceInput: "0.00" }],
        },
      ],
    }));

  const save = () => {
    if (!canSave) return;
    onSave(toItem(draft));
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={isNew ? "Nuevo producto" : `Editar ${draft.name || "producto"}`}>
      <button type="button" aria-label="Cerrar editor" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-2 top-4 flex max-h-[calc(100dvh-2rem)] flex-col rounded-xl border bg-card shadow-xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:max-h-[92dvh] sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2">
        <div className="flex items-start justify-between gap-3 border-b p-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{isNew ? "Nuevo producto" : "Editar producto"}</h2>
            <p className="text-sm text-muted-foreground">Sincroniza en POS, carta QR, WhatsApp y agregadores.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X />
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* General */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Nombre" htmlFor="p-name">
                <Input
                  id="p-name"
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Ej. Tacos de suadero"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Descripción" htmlFor="p-desc">
                <textarea
                  id="p-desc"
                  value={draft.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  rows={2}
                  className={cn(inputCls, "h-auto min-h-20 py-2")}
                  placeholder="Se muestra en carta QR y agregadores"
                />
              </Field>
            </div>
            <Field label="Categoría" htmlFor="p-cat">
              <select
                id="p-cat"
                value={draft.category}
                onChange={(e) => patch({ category: e.target.value })}
                className={inputCls}
              >
                {MENU_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Precio (PEN)" htmlFor="p-price">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="p-price"
                  type="number"
                  min="0"
                  step="0.50"
                  inputMode="decimal"
                  value={draft.priceInput}
                  onChange={(e) => patch({ priceInput: e.target.value })}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </Field>
            <div className="flex items-center gap-6 sm:col-span-2">
              <Toggle
                checked={draft.available}
                onChange={(v) => patch({ available: v })}
                label="Disponible (sin flag 86)"
              />
              <Toggle checked={draft.active} onChange={(v) => patch({ active: v })} label="Activo en todos los canales" />
            </div>
          </section>

          {/* Alérgenos */}
          <section>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Alérgenos</p>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map((a) => {
                const on = draft.allergens.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      patch({ allergens: on ? draft.allergens.filter((x) => x !== a) : [...draft.allergens, a] })
                    }
                    className={cn(
                      "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      on
                        ? "border-warning/20 bg-warning/10 text-warning-text"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Traducciones */}
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Traducciones</p>
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setLang(l.code)}
                    className={cn(
                      "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      lang === l.code ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {l.code}
                  </button>
                ))}
              </div>
            </div>
            {lang === "es" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre (principal)" htmlFor="t-es-name">
                  <Input id="t-es-name" value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
                </Field>
                <Field label="Descripción (principal)" htmlFor="t-es-desc">
                  <Input id="t-es-desc" value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
                </Field>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`Nombre (${lang})`} htmlFor={`t-${lang}-name`}>
                  <Input
                    id={`t-${lang}-name`}
                    value={draft.translations[lang].name}
                    onChange={(e) => patchTranslation(lang, { name: e.target.value })}
                  />
                </Field>
                <Field label={`Descripción (${lang})`} htmlFor={`t-${lang}-desc`}>
                  <Input
                    id={`t-${lang}-desc`}
                    value={draft.translations[lang].description}
                    onChange={(e) => patchTranslation(lang, { description: e.target.value })}
                  />
                </Field>
              </div>
            )}
          </section>

          {/* Grupos de modificadores */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Grupos de modificadores</p>
              <Button size="sm" variant="outline" onClick={addGroup}>
                <Plus aria-hidden />
                Agregar grupo
              </Button>
            </div>
            {draft.groups.length === 0 && (
              <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                Sin grupos. Agrega uno para que el cliente elija preferencias (p. ej. “Sin cebolla”).
              </p>
            )}
            {draft.groups.map((g, gi) => (
              <div key={g.id} className="space-y-3 rounded-lg border p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
                  <Field label={`Nombre del grupo ${gi + 1}`} htmlFor={`g-${g.id}`}>
                    <Input
                      id={`g-${g.id}`}
                      value={g.name}
                      onChange={(e) => patchGroup(g.id, { name: e.target.value })}
                      placeholder="Ej. ¿Cómo la quieres?"
                    />
                  </Field>
                  <Field label="Mín." htmlFor={`min-${g.id}`}>
                    <Input
                      id={`min-${g.id}`}
                      type="number"
                      min="0"
                      value={g.minSelect}
                      onChange={(e) => patchGroup(g.id, { minSelect: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-16"
                    />
                  </Field>
                  <Field label="Máx." htmlFor={`max-${g.id}`}>
                    <Input
                      id={`max-${g.id}`}
                      type="number"
                      min="1"
                      value={g.maxSelect}
                      onChange={(e) => patchGroup(g.id, { maxSelect: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-16"
                    />
                  </Field>
                  <div className="flex items-end justify-between gap-3 sm:justify-start">
                    <Toggle checked={g.required} onChange={(v) => patchGroup(g.id, { required: v })} label="Obligatorio" />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar grupo ${g.name || gi + 1}`}
                      onClick={() => setDraft((d) => ({ ...d, groups: d.groups.filter((x) => x.id !== g.id) }))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {g.modifiers.map((m, mi) => (
                    <div key={m.id} className="flex items-end gap-2">
                      <div className="flex-1">
                        <label htmlFor={`m-${m.id}`} className="sr-only">
                          Modificador {mi + 1}
                        </label>
                        <Input
                          id={`m-${m.id}`}
                          value={m.name}
                          onChange={(e) =>
                            patchGroup(g.id, {
                              modifiers: g.modifiers.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)),
                            })
                          }
                          placeholder={`Modificador ${mi + 1}`}
                        />
                      </div>
                      <div className="relative w-28">
                        <label htmlFor={`mp-${m.id}`} className="sr-only">
                          Precio extra
                        </label>
                        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-muted-foreground">
                          +$
                        </span>
                        <Input
                          id={`mp-${m.id}`}
                          type="number"
                          min="0"
                          step="0.50"
                          value={m.priceInput}
                          onChange={(e) =>
                            patchGroup(g.id, {
                              modifiers: g.modifiers.map((x) => (x.id === m.id ? { ...x, priceInput: e.target.value } : x)),
                            })
                          }
                          className="pl-7"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Quitar modificador ${m.name || mi + 1}`}
                        onClick={() =>
                          patchGroup(g.id, { modifiers: g.modifiers.filter((x) => x.id !== m.id) })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      patchGroup(g.id, {
                        modifiers: [...g.modifiers, { id: crypto.randomUUID(), name: "", priceInput: "0.00" }],
                      })
                    }
                  >
                    <Plus aria-hidden />
                    Agregar modificador
                  </Button>
                </div>
              </div>
            ))}
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t p-5">
          <p className="text-xs text-muted-foreground">
            {canSave ? "Se sincroniza con todos los canales al guardar." : "Nombre y precio mayor a $0 son obligatorios."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={!canSave}>
              Guardar producto
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>(MENU_ITEMS);
  const [filtro, setFiltro] = useState<string>("Todas");
  const [editor, setEditor] = useState<{ draft: Draft; isNew: boolean } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const visible = useMemo(
    () => (filtro === "Todas" ? items : items.filter((p) => p.category === filtro)),
    [items, filtro],
  );

  const openNew = () => setEditor({ draft: newDraft(items.length), isNew: true });
  const openEdit = (item: MenuItem) => setEditor({ draft: toDraft(item), isNew: false });

  const save = (item: MenuItem) => {
    setItems((prev) => (prev.some((p) => p.id === item.id) ? prev.map((p) => (p.id === item.id ? item : p)) : [...prev, item]));
    setEditor(null);
    setBanner("Producto guardado · sincronizado con todos los canales");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Menú</h1>
          <p className="text-sm text-muted-foreground">Fuente única: alimenta POS, carta QR, WhatsApp y agregadores</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Camera aria-hidden />
            Foto → menú (IA)
          </Button>
          <Button onClick={openNew}>
            <Plus aria-hidden />
            Producto
          </Button>
        </div>
      </div>

      {banner && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success-text"
        >
          <span>{banner}</span>
          <Button variant="ghost" size="icon" onClick={() => setBanner(null)} aria-label="Descartar aviso">
            <X />
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filtrar por categoría">
        {["Todas", ...MENU_CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={filtro === c}
            onClick={() => setFiltro(c)}
            className={cn(
              "cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filtro === c ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {c}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{visible.length} de {items.length} productos</span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {visible.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => openEdit(p)}
            className="group cursor-pointer overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-shadow hover:shadow-md"
          >
            <div className={`h-28 bg-gradient-to-br ${p.gradient}`} aria-hidden />
            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                </div>
                <p className="text-sm font-bold tabular-nums">{moneyExact(p.priceCents)}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Badge variant={p.available ? "success" : "danger"}>{p.available ? "Disponible" : "86 · agotado"}</Badge>
                {!p.active && <Badge variant="outline">Inactivo</Badge>}
                <span className="ml-auto text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Editar
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Haz clic en cualquier producto para editarlo: precio, traducciones, alérgenos y grupos de modificadores se
        publican al instante en todos los canales.
      </p>

      {editor && (
        <ProductEditor
          key={editor.draft.id}
          item={editor.draft}
          isNew={editor.isNew}
          onClose={() => setEditor(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
