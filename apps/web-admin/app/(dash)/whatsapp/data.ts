/**
 * Bandeja de pedidos por WhatsApp — mock local con la misma forma que
 * devolvería GET /api/whatsapp, para que la UI no distinga entre mock y API.
 */

export interface WaMessage {
  id: string;
  from: "customer" | "business";
  text: string;
  /** HH:MM 24h — el formato lo fija la API, la UI solo lo muestra. */
  at: string;
}

export interface WaOrderItem {
  name: string;
  qty: number;
  priceCents: number;
}

export interface WaExtractedOrder {
  id: string;
  items: WaOrderItem[];
  totalCents: number;
  /** Nota libre del cliente (sin cebolla, campanario, etc.). */
  note?: string;
  extractedAt: string;
}

export interface WaConversation {
  id: string;
  customerName: string;
  phone: string;
  lastAt: string;
  unread: boolean;
  messages: WaMessage[];
  /** Orden extraída automáticamente del último mensaje del cliente. */
  order: WaExtractedOrder | null;
}

export interface WhatsAppInbox {
  number: { verified: boolean; phone: string };
  conversations: WaConversation[];
}

export const FALLBACK_WHATSAPP: WhatsAppInbox = {
  number: { verified: true, phone: "+51 91234 5678" },
  conversations: [
    {
      id: "w1",
      customerName: "Marcos Linares",
      phone: "+51 98080 2020",
      lastAt: "14:41",
      unread: true,
      messages: [
        { id: "w1-m1", from: "business", text: "¡Hola! Bienvenido a Cevichería El Muelle 🌮 ¿Qué te preparo hoy?", at: "14:32" },
        { id: "w1-m2", from: "customer", text: "Buenas, quiero 2 ceviche de pescado, 1 gringa y 2 refrescos", at: "14:40" },
        { id: "w1-m3", from: "customer", text: "La gringa sin cebolla, por favor", at: "14:41" },
      ],
      order: {
        id: "wo-515",
        items: [
          { name: "Ceviche de pescado", qty: 2, priceCents: 5_000 },
          { name: "Ceviche mixto", qty: 1, priceCents: 4_500 },
          { name: "Refresco 600ml", qty: 2, priceCents: 4_000 },
        ],
        totalCents: 13_500,
        note: "Ceviche mixto sin cebolla",
        extractedAt: "14:41",
      },
    },
    {
      id: "w2",
      customerName: "Paola Guzmán",
      phone: "+51 93131 9090",
      lastAt: "14:12",
      unread: false,
      messages: [
        { id: "w2-m1", from: "customer", text: "¿Tienen chicha morada en litro?", at: "14:08" },
        { id: "w2-m2", from: "business", text: "¡Sí, Paola! Litro a $55. ¿Te la aparto?", at: "14:10" },
        { id: "w2-m3", from: "customer", text: "Sí y agrega un TIRADITO por favor", at: "14:12" },
      ],
      order: {
        id: "wo-514",
        items: [
          { name: "Chicha morada 1L", qty: 1, priceCents: 5_500 },
          { name: "TIRADITO", qty: 1, priceCents: 5_000 },
        ],
        totalCents: 10_500,
        extractedAt: "14:12",
      },
    },
    {
      id: "w3",
      customerName: "Óscar Treviño",
      phone: "+51 94040 7070",
      lastAt: "13:48",
      unread: false,
      messages: [
        { id: "w3-m1", from: "customer", text: "A qué hora cierran hoy?", at: "13:45" },
        { id: "w3-m2", from: "business", text: "Cerramos a las 22:00, ¡te esperamos!", at: "13:46" },
        { id: "w3-m3", from: "customer", text: "Perfecto, paso por unas quesadillas luego", at: "13:48" },
      ],
      order: null,
    },
    {
      id: "w4",
      customerName: "Fernanda Solís",
      phone: "+51 95656 3030",
      lastAt: "13:20",
      unread: false,
      messages: [
        { id: "w4-m1", from: "customer", text: "Quiero pedir a domicilio para 6 personas, qué me recomiendas?", at: "13:20" },
      ],
      order: null,
    },
  ],
};

/** Guard defensivo: si la API responde con otra forma, caemos al fallback. */
export function isWhatsAppInbox(value: unknown): value is WhatsAppInbox {
  if (typeof value !== "object" || value === null) return false;
  const v = value as WhatsAppInbox;
  return typeof v.number === "object" && Array.isArray(v.conversations);
}

export const PAYMENT_LINK = "pay.rest.mx/cevicheria-el-muelle/8f3k";
