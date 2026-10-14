import type { Category, ModifierGroup, Product } from "@rest/types";

/**
 * Catálogo semilla del POS — se usa como modo demo offline cuando el bootstrap
 * (GET /api/bootstrap) falla o aún no responde. Con bootstrap vivo, el catálogo
 * real llega por red (ver lib/api.ts). Dinero siempre en centavos: usa
 * formatMoney() de @rest/printer.
 */

export const categories: Category[] = [
  { id: "c1", name: "Ceviches", sortOrder: 0, active: true },
  { id: "c2", name: "Platos de fondo", sortOrder: 1, active: true },
  { id: "c3", name: "Bebidas", sortOrder: 2, active: true },
  { id: "c4", name: "Postres", sortOrder: 3, active: true },
];

const grupoPreferencia: ModifierGroup = {
  id: "g1",
  name: "¿Cómo lo quieres?",
  required: true,
  minSelect: 1,
  maxSelect: 3,
  modifiers: [
    { id: "m1", name: "Con todo", priceCents: 0 },
    { id: "m2", name: "Sin cebolla", priceCents: 0 },
    { id: "m3", name: "Sin culantro", priceCents: 0 },
    { id: "m4", name: "Ají suave", priceCents: 0 },
    { id: "m5", name: "Extra camote", priceCents: 300 },
  ],
};

const grupoBebida: ModifierGroup = {
  id: "g2",
  name: "¿Fría o natural?",
  required: true,
  minSelect: 1,
  maxSelect: 1,
  modifiers: [
    { id: "m6", name: "Fría", priceCents: 0 },
    { id: "m7", name: "Natural", priceCents: 0 },
  ],
};

export const products: Product[] = [
  { id: "p1", categoryId: "c1", name: "Ceviche de pescado", priceCents: 2_500, active: true, available: true, modifierGroups: [grupoPreferencia] },
  { id: "p2", categoryId: "c1", name: "Ceviche mixto", priceCents: 3_200, active: true, available: true, modifierGroups: [grupoPreferencia] },
  { id: "p3", categoryId: "c1", name: "Tiradito", priceCents: 2_400, active: true, available: true, modifierGroups: [grupoPreferencia] },
  { id: "p4", categoryId: "c1", name: "Ceviche de camarones", priceCents: 3_500, active: true, available: true, modifierGroups: [grupoPreferencia] },
  { id: "p5", categoryId: "c2", name: "Lomo saltado", priceCents: 2_800, active: true, available: true, modifierGroups: [] },
  { id: "p6", categoryId: "c2", name: "Ají de gallina", priceCents: 2_200, active: true, available: true, modifierGroups: [] },
  { id: "p7", categoryId: "c3", name: "Chicha morada", priceCents: 800, active: true, available: true, modifierGroups: [grupoBebida] },
  { id: "p8", categoryId: "c3", name: "Inca Kola 500ml", priceCents: 500, active: true, available: true, modifierGroups: [] },
  { id: "p9", categoryId: "c3", name: "Cerveza artesanal", priceCents: 1_200, active: true, available: false, modifierGroups: [] },
  { id: "p10", categoryId: "c4", name: "Picarones", priceCents: 1_000, active: true, available: true, modifierGroups: [] },
  { id: "p11", categoryId: "c4", name: "Suspiro limeño", priceCents: 1_200, active: true, available: false, modifierGroups: [] },
];
