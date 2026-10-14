/**
 * Capa 2 de impresión térmica (docs/03-arquitectura.md §Impresión térmica):
 * encoding ESC/POS real con @point-of-sale/receipt-printer-encoder + transports
 * del navegador (Web Bluetooth / WebUSB / WebSerial).
 *
 * La capa 1 (@rest/printer) define el modelo ReceiptDocument; aquí lo traducimos
 * a comandos ESC/POS con estilos reales (bold/align/QR) y lo enviamos al papel.
 * NetworkReceiptPrinter quedó fuera: usa sockets de Node y no aplica en browser.
 */
import {
  PAPER_WIDTHS,
  formatMoney,
  type PaperWidth,
  type ReceiptDocument,
} from "@rest/printer";
import { LOCALE } from "@rest/types";

export type PrinterTransport = "bluetooth" | "usb" | "serial";
export type PrinterStatus = "disconnected" | "connecting" | "connected" | "error";

export interface ThermalPrinterState {
  status: PrinterStatus;
  transport: PrinterTransport | null;
  /** Nombre legible de la impresora conectada (si el transporte lo reporta). */
  name: string | null;
  error: string | null;
}

export interface PrinterTransportInfo {
  kind: PrinterTransport;
  label: string;
  available: boolean;
  hint: string;
}

const STORAGE_KEY = "rest.pos.printer";

interface StoredPrinter {
  transport: PrinterTransport;
  device: { type: string; id: string; name?: string };
}

// ── Disponibilidad de transports (requieren HTTPS o localhost) ──────────────

export function transportsAvailable(): PrinterTransportInfo[] {
  if (typeof navigator === "undefined") return [];
  return [
    {
      kind: "bluetooth",
      label: "Bluetooth",
      available: "bluetooth" in navigator,
      hint: "Chrome/Edge o Android con HTTPS. Requiere elegir la impresora una vez.",
    },
    {
      kind: "usb",
      label: "USB",
      available: "usb" in navigator,
      hint: "Chrome/Edge con HTTPS. Cable directo a la tablet.",
    },
    {
      kind: "serial",
      label: "Serial",
      available: "serial" in navigator,
      hint: "Chrome/Edge con HTTPS. Adaptador USB-serial o cable directo.",
    },
  ];
}

// ── Errores legibles en español ─────────────────────────────────────────────

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  if (/cancel|dismissed|user (cancelled|canceled)/i.test(message))
    return "Selección de impresora cancelada.";
  if (/not ?found|no.*devices|no.*printers/i.test(message))
    return "No se encontró ninguna impresora. Verifica que esté encendida y emparejada.";
  if (/not ?supported|unsupported|unavailable/i.test(message))
    return "Tu navegador no soporta este tipo de conexión (usa Chrome/Edge con HTTPS).";
  if (/security|insecure|https/i.test(message))
    return "La conexión requiere HTTPS (o localhost en pruebas).";
  if (/claim|busy|open/i.test(message))
    return "La impresora está ocupada o abierta por otra pestaña.";
  return message;
}

// ── Cliente singleton ───────────────────────────────────────────────────────

type StateListener = (state: ThermalPrinterState) => void;

/** Instancia de impresora ya conectada, con su API común reducida. */
interface ConnectedPrinter {
  transport: PrinterTransport;
  device: { type: string; id: string; name?: string };
  print(bytes: Uint8Array): void;
  disconnect(): void;
  /** Intenta reconectar al último dispositivo guardado. Null si no aplica. */
  reconnect(device: { type: string; id: string; name?: string }): Promise<void>;
  addEventListener?(type: "disconnected", cb: (device: unknown) => void): void;
}

class ThermalPrinterClient {
  private state: ThermalPrinterState = {
    status: "disconnected",
    transport: null,
    name: null,
    error: null,
  };
  private listeners = new Set<StateListener>();
  private printer: ConnectedPrinter | null = null;

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): ThermalPrinterState {
    return this.state;
  }

  private setState(patch: Partial<ThermalPrinterState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  /** Última impresora guardada (para reconectar al cargar). */
  readStored(): StoredPrinter | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredPrinter) : null;
    } catch {
      return null;
    }
  }

  private store(entry: StoredPrinter | null) {
    if (typeof window === "undefined") return;
    try {
      if (entry) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* quota/privado: sin persistencia, la sesión actual basta */
    }
  }

  /**
   * Conecta una impresora del transporte dado. DEBE llamarse desde un gesto
   * del usuario (clic) porque los navegadores exigen consentimiento.
   */
  async connect(transport: PrinterTransport): Promise<void> {
    await this.disconnect();
    this.setState({ status: "connecting", transport, error: null });
    try {
      this.printer = await this.openPrinter(transport);
      this.store({ transport, device: this.printer.device });
      this.setState({
        status: "connected",
        transport,
        name: this.printer.device.name ?? `${transport} #${this.printer.device.id.slice(0, 8)}`,
      });
    } catch (err) {
      this.printer = null;
      this.setState({ status: "error", transport, error: friendlyError(err) });
      throw new Error(friendlyError(err));
    }
  }

  /** Reconexión silenciosa al cargar la app: sin diálogos, falla en silencio. */
  async tryReconnect(): Promise<void> {
    const stored = this.readStored();
    if (!stored || this.printer) return;
    this.setState({ status: "connecting", transport: stored.transport, error: null });
    try {
      this.printer = await this.openPrinter(stored.transport, stored.device);
      this.setState({
        status: "connected",
        transport: stored.transport,
        name: this.printer.device.name ?? stored.device.name ?? null,
      });
    } catch {
      // Reconnect() del navegador solo funciona si el SO recuerda el dispositivo;
      // si no, el usuario toca "Conectar" de nuevo.
      this.printer = null;
      this.setState({ status: "disconnected", transport: stored.transport, error: null });
    }
  }

  async disconnect(): Promise<void> {
    if (this.printer) {
      try {
        this.printer.disconnect();
      } catch {
        /* ya desconectada */
      }
    }
    this.printer = null;
    this.setState({ status: "disconnected", transport: null, name: null, error: null });
  }

  /** "Olvidar" también borra la persistencia (cambio de impresora). */
  async forget(): Promise<void> {
    await this.disconnect();
    this.store(null);
  }

  async print(doc: ReceiptDocument, paper: PaperWidth = "mm58"): Promise<void> {
    if (!this.printer) throw new Error("No hay impresora conectada.");
    const bytes = await encodeReceipt(doc, paper);
    this.printer.print(bytes);
  }

  /** Ticket de prueba corto para validar la conexión. */
  async printTest(paper: PaperWidth = "mm58"): Promise<void> {
    const doc: ReceiptDocument = {
      storeName: "Rest · Prueba",
      ticketNumber: "T-0001",
      isoDate: new Date().toISOString(),
      items: [{ quantity: 1, name: "Producto de prueba", unitPriceCents: 0, totalCents: 0 }],
      subtotalCents: 0,
      totalCents: 0,
      paymentLine: "Ticket de prueba de impresora",
      footer: "Si lees esto, la impresora funciona ✔",
    };
    await this.print(doc, paper);
  }

  // ── Transportes ───────────────────────────────────────────────────────────

  private attachEvents(printer: ConnectedPrinter, transport: PrinterTransport) {
    const onDisconnected = () => {
      if (this.printer === printer) {
        this.printer = null;
        this.setState({ status: "disconnected", transport, name: null });
      }
    };
    printer.addEventListener?.("disconnected", onDisconnected);
  }

  private async openPrinter(
    transport: PrinterTransport,
    storedDevice?: { type: string; id: string; name?: string },
  ): Promise<ConnectedPrinter> {
    if (transport === "bluetooth") {
      const { WebBluetoothReceiptPrinter } = await import(
        "@point-of-sale/webbluetooth-receipt-printer"
      );
      const printer = new WebBluetoothReceiptPrinter({
        // Filtrado amplio: la mayoría de impresoras térmicas expone el servicio
        // serie BLE estándar; sin filters el diálogo muestra todo.
        optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
      });
      printer.addEventListener("connected", (device) => {
        this.setState({
          status: "connected",
          transport,
          name: device.name ?? device.id.slice(0, 8),
        });
        if (device.id) this.store({ transport, device });
      });
      if (storedDevice) await printer.reconnect(storedDevice);
      else await printer.connect();
      const attached: ConnectedPrinter = {
        transport,
        device: storedDevice ?? { type: "bluetooth", id: "", name: undefined },
        print: (bytes) => printer.print(bytes),
        disconnect: () => printer.disconnect(),
        reconnect: async (device) => printer.reconnect(device),
      };
      this.attachEvents(attached, transport);
      return attached;
    }

    if (transport === "usb") {
      const { WebUSBReceiptPrinter } = await import("@point-of-sale/webusb-receipt-printer");
      const printer = new WebUSBReceiptPrinter();
      printer.addEventListener("connected", (device) => {
        this.setState({
          status: "connected",
          transport,
          name: device.name ?? device.id.slice(0, 8),
        });
        if (device.id) this.store({ transport, device });
      });
      if (storedDevice) await printer.reconnect(storedDevice);
      else await printer.connect();
      const attached: ConnectedPrinter = {
        transport,
        device: storedDevice ?? { type: "usb", id: "", name: undefined },
        print: (bytes) => printer.print(bytes),
        disconnect: () => printer.disconnect(),
        reconnect: async (device) => printer.reconnect(device),
      };
      this.attachEvents(attached, transport);
      return attached;
    }

    const { WebSerialReceiptPrinter } = await import("@point-of-sale/webserial-receipt-printer");
    const printer = new WebSerialReceiptPrinter();
    printer.addEventListener("connected", (device) => {
      this.setState({
        status: "connected",
        transport,
        name: device.name ?? device.id.slice(0, 8),
      });
      if (device.id) this.store({ transport, device });
    });
    if (storedDevice) await printer.reconnect(storedDevice);
    else await printer.connect();
    const attached: ConnectedPrinter = {
      transport,
      device: storedDevice ?? { type: "serial", id: "", name: undefined },
      print: (bytes) => printer.print(bytes),
      disconnect: () => printer.disconnect(),
      reconnect: async (device) => printer.reconnect(device),
    };
    this.attachEvents(attached, transport);
    return attached;
  }
}

export const thermalPrinter = new ThermalPrinterClient();

// ── Encoding ESC/POS desde ReceiptDocument ──────────────────────────────────

/** Une left/right en una línea del ancho del papel (mismo criterio que capa 1). */
function columns(left: string, right: string, width: number): string {
  const space = Math.max(1, width - left.length - right.length);
  return (left + " ".repeat(space) + right).slice(0, width);
}

/**
 * ReceiptDocument → bytes ESC/POS con estilos reales. Duplicamos el layout
 * mínimo de renderReceipt() porque el encoder necesita los comandos por línea
 * (bold/align/QR), que el string plano de capa 1 pierde.
 *
 * El import del encoder es dinámico: el paquete referencia ImageData (API de
 * browser) al evaluarse y debe cargarse solo en interacciones del cliente.
 */
export async function encodeReceipt(doc: ReceiptDocument, paper: PaperWidth = "mm58"): Promise<Uint8Array> {
  const { ReceiptPrinterEncoder } = await import("@point-of-sale/receipt-printer-encoder");
  const width = PAPER_WIDTHS[paper];
  const encoder = new ReceiptPrinterEncoder({ width, language: "escpos" });
  const dashes = "-".repeat(width);

  encoder.initialize();
  encoder.align("center").bold(true).line(doc.storeName);
  encoder.bold(false);
  if (doc.locationName) encoder.line(doc.locationName);

  encoder.align("left").bold(true).line(`Ticket: ${doc.ticketNumber}`);
  encoder.bold(false);
  const meta = [
    doc.channel ? `Canal: ${doc.channel}` : null,
    doc.table ? `Mesa: ${doc.table}` : null,
    doc.staffName ? `Atendió: ${doc.staffName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (meta) encoder.line(meta);
  encoder.line(new Date(doc.isoDate).toLocaleString(LOCALE));
  encoder.line(dashes);

  for (const item of doc.items) {
    encoder.line(
      columns(`${item.quantity}x ${item.name}`, formatMoney(item.totalCents), width),
    );
    for (const modifier of item.modifiers ?? []) encoder.line(`   + ${modifier}`);
    if (item.notes) encoder.line(`   * ${item.notes}`);
  }

  encoder.line(dashes);
  encoder.line(columns("Subtotal", formatMoney(doc.subtotalCents), width));
  if (doc.discountCents && doc.discountCents > 0) {
    encoder.line(columns("Descuento", `-${formatMoney(doc.discountCents)}`, width));
  }
  encoder.bold(true).line(columns("TOTAL", formatMoney(doc.totalCents), width));
  encoder.bold(false);
  if (doc.paymentLine) encoder.line(doc.paymentLine);
  if (doc.footer) encoder.align("center").line(doc.footer).align("left");
  if (doc.qrText) encoder.align("center").qrcode(doc.qrText).align("left");

  encoder.feed(2).cut("partial");
  return encoder.encode();
}
