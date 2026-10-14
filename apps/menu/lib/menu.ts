import type { Category, Product } from "@rest/types";

/** Carta mock F0 — en F2 viene del mismo catálogo del admin (fuente única). */

export const categories: Category[] = [
  { id: "c1", name: "Ceviches", sortOrder: 0, active: true },
  { id: "c2", name: "Platos de fondo", sortOrder: 1, active: true },
  { id: "c3", name: "Bebidas", sortOrder: 2, active: true },
  { id: "c4", name: "Postres", sortOrder: 3, active: true },
];

export const products: Array<Product & { description: string; gradient: string }> = [
  { id: "p1", categoryId: "c1", name: "Ceviche de pescado", description: "Lenguado fresco, leche de tigre, camote y cancha", priceCents: 2_500, active: true, available: true, modifierGroups: [], gradient: "from-orange-300 to-red-400" },
  { id: "p2", categoryId: "c1", name: "Ceviche mixto", description: "Pescado, calamar y camarón al ajillo", priceCents: 3_200, active: true, available: true, modifierGroups: [], gradient: "from-amber-300 to-orange-400" },
  { id: "p3", categoryId: "c1", name: "Tiradito", description: "Láminas de pescado con leche de tigre y ají amarillo", priceCents: 2_400, active: true, available: true, modifierGroups: [], gradient: "from-yellow-300 to-amber-400" },
  { id: "p4", categoryId: "c1", name: "Ceviche de camarones", description: "Camarón de río, choclo y culantro", priceCents: 3_500, active: true, available: true, modifierGroups: [], gradient: "from-red-300 to-rose-400" },
  { id: "p5", categoryId: "c2", name: "Lomo saltado", description: "Res al wok con papas fritas y arroz", priceCents: 2_800, active: true, available: true, modifierGroups: [], gradient: "from-yellow-200 to-amber-300" },
  { id: "p6", categoryId: "c2", name: "Ají de gallina", description: "Crema de ají amarillo con arroz blanco", priceCents: 2_200, active: true, available: true, modifierGroups: [], gradient: "from-lime-300 to-green-500" },
  { id: "p7", categoryId: "c3", name: "Chicha morada", description: "Preparada en casa, 600 ml", priceCents: 800, active: true, available: true, modifierGroups: [], gradient: "from-stone-200 to-amber-100" },
  { id: "p8", categoryId: "c3", name: "Inca Kola 500ml", description: "Bien helada", priceCents: 500, active: true, available: true, modifierGroups: [], gradient: "from-zinc-400 to-zinc-600" },
  { id: "p9", categoryId: "c4", name: "Picarones", description: "Con miel de chancaca", priceCents: 1_000, active: true, available: true, modifierGroups: [], gradient: "from-orange-200 to-amber-400" },
  { id: "p10", categoryId: "c4", name: "Suspiro limeño", description: "Manjar blanco y merengue al oporto", priceCents: 1_200, active: true, available: true, modifierGroups: [], gradient: "from-amber-300 to-yellow-500" },
];

export const money = (cents: number) =>
  (cents / 100).toLocaleString("es-PE", { style: "currency", currency: "PEN" });
