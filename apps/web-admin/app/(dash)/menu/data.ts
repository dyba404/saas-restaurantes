/**
 * Catálogo del menú para el editor del admin — misma forma de dominio que
 * apps/pos/lib/catalog.ts (dinero en centavos) extendida con los campos que
 * solo maneja el admin: descripción, alérgenos, traducciones y foto (gradiente
 * demo hasta que suban imágenes reales). Todo local: al conectar DB (F1) esta
 * forma se mapea 1:1 a la tabla de productos.
 */

export interface Translation {
  name: string;
  description: string;
}

export type Language = "es" | "en" | "pt";

export interface Modifier {
  id: string;
  name: string;
  /** Precio extra en centavos (0 = sin costo). */
  priceCents: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  modifiers: Modifier[];
}

export interface MenuItem {
  id: string;
  /** Nombre en español — idioma principal de la organización. */
  name: string;
  description: string;
  category: string;
  priceCents: number;
  /** Flag "86": activo pero agotado hoy. */
  available: boolean;
  /** Inactivo = no se vende ni aparece en ningún canal. */
  active: boolean;
  allergens: string[];
  gradient: string;
  translations: Record<Language, Translation>;
  modifierGroups: ModifierGroup[];
}

export const MENU_CATEGORIES = ["Ceviches", "Antojitos", "Bebidas", "Postres"] as const;

export const ALLERGENS = ["gluten", "lácteos", "frutos secos", "mariscos", "picante"] as const;

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
];

/** Conversión soles → centavos (el input es texto libre con punto o coma). */
export function solesToCents(value: string): number {
  const n = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

/** Centavos → texto del input en soles (p. ej. 2500 → "25.00"). */
export function centsToSolesInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

// ── Grupos de modificadores (fábricas: cada producto recibe copia propia) ───

const grupoPreferencia = (base: string): ModifierGroup => ({
  id: `${base}-g1`,
  name: "¿Cómo la quieres?",
  required: true,
  minSelect: 1,
  maxSelect: 3,
  modifiers: [
    { id: `${base}-m1`, name: "Con todo", priceCents: 0 },
    { id: `${base}-m2`, name: "Sin cebolla", priceCents: 0 },
    { id: `${base}-m3`, name: "Sin cilantro", priceCents: 0 },
    { id: `${base}-m4`, name: "Salsa verde", priceCents: 0 },
    { id: `${base}-m5`, name: "Extra queso", priceCents: 1_000 },
  ],
});

const grupoBebida = (base: string): ModifierGroup => ({
  id: `${base}-g1`,
  name: "¿Fría o natural?",
  required: true,
  minSelect: 1,
  maxSelect: 1,
  modifiers: [
    { id: `${base}-m1`, name: "Fría", priceCents: 0 },
    { id: `${base}-m2`, name: "Natural", priceCents: 0 },
  ],
});

const grupoExtrasPostre = (base: string): ModifierGroup => ({
  id: `${base}-g1`,
  name: "Extras",
  required: false,
  minSelect: 0,
  maxSelect: 2,
  modifiers: [
    { id: `${base}-m1`, name: "Nata", priceCents: 1_500 },
    { id: `${base}-m2`, name: "Cajeta", priceCents: 1_000 },
  ],
});

// ── Catálogo demo (12 productos, mismos ids/precios que el POS) ──────────────

export const MENU_ITEMS: MenuItem[] = [
  {
    id: "p1",
    name: "Ceviche de pescado",
    description: "Trompo de adobo achiote, piña asada, cebolla y cilantro sobre tortilla de maíz.",
    category: "Ceviches",
    priceCents: 2_500,
    available: true,
    active: true,
    allergens: ["picante"],
    gradient: "from-orange-300 to-red-400",
    translations: {
      es: { name: "Ceviche de pescado", description: "Trompo de adobo achiote, piña asada, cebolla y cilantro sobre tortilla de maíz." },
      en: { name: "Al pastor tacos", description: "Achiote-marinated pork spit, grilled pineapple, onion and cilantro on corn tortilla." },
      pt: { name: "Tacos al pastor", description: "Carne marinada no achiote, abacaxi grelhado, cebola e coentro na tortilha de milho." },
    },
    modifierGroups: [grupoPreferencia("p1")],
  },
  {
    id: "p2",
    name: "Ceviche mixto",
    description: "Tortilla de harina con carne de pastor, queso fundido y piña.",
    category: "Ceviches",
    priceCents: 4_500,
    available: true,
    active: true,
    allergens: ["gluten", "lácteos", "picante"],
    gradient: "from-amber-300 to-orange-400",
    translations: {
      es: { name: "Ceviche mixto", description: "Tortilla de harina con carne de pastor, queso fundido y piña." },
      en: { name: "Ceviche mixto", description: "Flour tortilla with al pastor pork, melted cheese and pineapple." },
      pt: { name: "Ceviche mixto", description: "Tortilha de farinha com carne al pastor, queijo derretido e abacaxi." },
    },
    modifierGroups: [grupoPreferencia("p2")],
  },
  {
    id: "p3",
    name: "Ají de gallina",
    description: "Pollo a la plancha con pico de gallo y aguacate.",
    category: "Ceviches",
    priceCents: 2_200,
    available: true,
    active: true,
    allergens: [],
    gradient: "from-yellow-300 to-amber-400",
    translations: {
      es: { name: "Ají de gallina", description: "Pollo a la plancha con pico de gallo y aguacate." },
      en: { name: "Chicken tacos", description: "Grilled chicken with pico de gallo and avocado." },
      pt: { name: "Tacos de frango", description: "Frango grelhado com pico de gallo e abacate." },
    },
    modifierGroups: [grupoPreferencia("p3")],
  },
  {
    id: "p4",
    name: "Tiraditos",
    description: "Tortilla de harina doblada con queso y carne de pastor.",
    category: "Ceviches",
    priceCents: 5_000,
    available: true,
    active: true,
    allergens: ["gluten", "lácteos", "picante"],
    gradient: "from-red-300 to-rose-400",
    translations: {
      es: { name: "Tiraditos", description: "Tortilla de harina doblada con queso y carne de pastor." },
      en: { name: "Tiraditos", description: "Folded flour tortilla with cheese and al pastor pork." },
      pt: { name: "Tiraditos", description: "Tortilha de farinha dobrada com queijo e carne al pastor." },
    },
    modifierGroups: [grupoPreferencia("p4")],
  },
  {
    id: "p5",
    name: "Lomo saltado",
    description: "Queso oaxaca gratinado con chorizo o champiñones, con tortillas.",
    category: "Antojitos",
    priceCents: 6_500,
    available: true,
    active: true,
    allergens: ["lácteos", "picante"],
    gradient: "from-yellow-200 to-amber-300",
    translations: {
      es: { name: "Lomo saltado", description: "Queso oaxaca gratinado con chorizo o champiñones, con tortillas." },
      en: { name: "Melted cheese", description: "Gratinated Oaxaca cheese with chorizo or mushrooms, served with tortillas." },
      pt: { name: "Queijo derretido", description: "Queijo Oaxaca gratinado com chorizo ou cogumelos, com tortilhas." },
    },
    modifierGroups: [],
  },
  {
    id: "p6",
    name: "Causa limeña",
    description: "Aguacate machacado con limón, cebolla, cilantro y totopos.",
    category: "Antojitos",
    priceCents: 5_500,
    available: true,
    active: true,
    allergens: [],
    gradient: "from-lime-300 to-green-500",
    translations: {
      es: { name: "Causa limeña", description: "Aguacate machacado con limón, cebolla, cilantro y totopos." },
      en: { name: "Causa limeña", description: "Mashed avocado with lime, onion, cilantro and tortilla chips." },
      pt: { name: "Causa limeña", description: "Abacate amassado com limão, cebola, coentro e tortilha chips." },
    },
    modifierGroups: [],
  },
  {
    id: "p7",
    name: "Chicha morada",
    description: "Arroz, canela y un toque de vainilla. Servida bien fría.",
    category: "Bebidas",
    priceCents: 1_500,
    available: true,
    active: true,
    allergens: [],
    gradient: "from-stone-200 to-amber-100",
    translations: {
      es: { name: "Chicha morada", description: "Arroz, canela y un toque de vainilla. Servida bien fría." },
      en: { name: "Horchata", description: "Rice, cinnamon and a hint of vanilla. Served chilled." },
      pt: { name: "Chicha morada", description: "Arroz, canela e um toque de baunilha. Servida bem gelada." },
    },
    modifierGroups: [grupoBebida("p7")],
  },
  {
    id: "p8",
    name: "Coca-Cola 600ml",
    description: "Refresco embotellado, servido frío.",
    category: "Bebidas",
    priceCents: 2_000,
    available: true,
    active: true,
    allergens: [],
    gradient: "from-zinc-400 to-zinc-600",
    translations: {
      es: { name: "Coca-Cola 600ml", description: "Refresco embotellado, servido frío." },
      en: { name: "Coca-Cola 600ml", description: "Bottled soda, served cold." },
      pt: { name: "Coca-Cola 600ml", description: "Refrigerante garrafa, servido gelado." },
    },
    modifierGroups: [],
  },
  {
    id: "p9",
    name: "Cerveza artesanal",
    description: "IPA local de barril, 355 ml.",
    category: "Bebidas",
    priceCents: 3_000,
    available: false,
    active: true,
    allergens: ["gluten"],
    gradient: "from-amber-400 to-yellow-600",
    translations: {
      es: { name: "Cerveza artesanal", description: "IPA local de barril, 355 ml." },
      en: { name: "Craft beer", description: "Local draft IPA, 355 ml." },
      pt: { name: "Cerveja artesanal", description: "IPA local de barril, 355 ml." },
    },
    modifierGroups: [],
  },
  {
    id: "p10",
    name: "Flan napolitano",
    description: "Flan casero con caramelo y crema batida.",
    category: "Postres",
    priceCents: 3_500,
    available: true,
    active: true,
    allergens: ["lácteos", "gluten"],
    gradient: "from-orange-200 to-amber-400",
    translations: {
      es: { name: "Flan napolitano", description: "Flan casero con caramelo y crema batida." },
      en: { name: "Neapolitan flan", description: "Homemade flan with caramel and whipped cream." },
      pt: { name: "Pudim napolitano", description: "Pudim caseiro com caramelo e chantilly." },
    },
    modifierGroups: [grupoExtrasPostre("p10")],
  },
  {
    id: "p11",
    name: "Gelatina de mosaico",
    description: "Gelatina de leche con mosaico de fresa, limón y uva.",
    category: "Postres",
    priceCents: 2_500,
    available: true,
    active: true,
    allergens: ["lácteos"],
    gradient: "from-fuchsia-300 to-purple-400",
    translations: {
      es: { name: "Gelatina de mosaico", description: "Gelatina de leche con mosaico de fresa, limón y uva." },
      en: { name: "Mosaic jello", description: "Milk jello with strawberry, lime and grape mosaic." },
      pt: { name: "Gelatina mosaico", description: "Gelatina de leite com mosaico de morango, limão e uva." },
    },
    modifierGroups: [],
  },
  {
    id: "p12",
    name: "Churros",
    description: "Crujientes, con azúcar y canela. Cajeta aparte.",
    category: "Postres",
    priceCents: 3_000,
    available: false,
    active: false,
    allergens: ["gluten"],
    gradient: "from-amber-300 to-yellow-500",
    translations: {
      es: { name: "Churros", description: "Crujientes, con azúcar y canela. Cajeta aparte." },
      en: { name: "Churros", description: "Crispy, with sugar and cinnamon. Dulce de leche on the side." },
      pt: { name: "Churros", description: "Crocantes, com açúcar e canela. Doce de leite à parte." },
    },
    modifierGroups: [],
  },
];

/** Gradientes demo para productos nuevos (rota por cantidad de productos). */
export const GRADIENTES_NUEVO = [
  "from-orange-300 to-red-400",
  "from-amber-300 to-orange-400",
  "from-lime-300 to-green-500",
  "from-sky-300 to-blue-400",
  "from-fuchsia-300 to-purple-400",
  "from-stone-300 to-zinc-400",
];
