/**
 * Declaraciones ambientales para las librerías @point-of-sale (JS puro, sin typings).
 * Solo el subconjunto que usa apps/pos/lib/thermal-printer.ts.
 *
 * OJO: @point-of-sale/network-receipt-printer usa sockets de Node y NO funciona
 * en el navegador; el POS expone Bluetooth/USB/Serial (y Red futura vía bridge).
 */

declare module "@point-of-sale/receipt-printer-encoder" {
  export interface EncoderOptions {
    /** Ancho de línea en caracteres (32 para 58mm, 48 para 80mm). */
    width?: number;
    language?: "escpos" | "starline" | "starprnt";
    codepage?: string;
    embedded?: boolean;
  }

  export class ReceiptPrinterEncoder {
    constructor(options?: EncoderOptions);
    initialize(): this;
    clear(): this;
    /** Alias moderno de columns(): ancho de línea en caracteres. */
    width(chars: number): this;
    align(align: "left" | "center" | "right"): this;
    bold(on: boolean): this;
    italic(on: boolean): this;
    underline(on: boolean | number): this;
    invert(on: boolean): this;
    size(width: number, height?: number): this;
    /** Texto sin salto de línea. */
    text(value: string): this;
    /** Texto + newline(). */
    line(value: string): this;
    newline(): this;
    feed(lines?: number): this;
    cut(mode?: "full" | "partial"): this;
    openDrawer(): this;
    qrcode(value: string, size?: number, level?: "L" | "M" | "Q" | "H", version?: number): this;
    encode(): Uint8Array;
  }
}

declare module "@point-of-sale/webbluetooth-receipt-printer" {
  export interface PrinterDevice {
    type: string;
    id: string;
    name?: string;
  }

  export class WebBluetoothReceiptPrinter {
    constructor(options?: {
      filters?: Array<{ name?: string; namePrefix?: string; services?: string[] }>;
      optionalServices?: (string | number)[];
    });
    /** Requiere gesto del usuario (clic). */
    connect(): Promise<void>;
    reconnect(device: PrinterDevice): Promise<void>;
    disconnect(): void;
    print(data: Uint8Array): void;
    addEventListener(type: "connected" | "disconnected", cb: (device: PrinterDevice) => void): void;
    removeEventListener(type: "connected" | "disconnected", cb: (event: Event) => void): void;
  }
}

declare module "@point-of-sale/webusb-receipt-printer" {
  export interface PrinterDevice {
    type: string;
    id: string;
    name?: string;
  }

  export class WebUSBReceiptPrinter {
    constructor(options?: { filters?: Array<{ vendorId?: number; productId?: number }> });
    /** Requiere gesto del usuario (clic). */
    connect(): Promise<void>;
    reconnect(device: PrinterDevice): Promise<void>;
    disconnect(): void;
    print(data: Uint8Array): void;
    addEventListener(type: "connected" | "disconnected", cb: (device: PrinterDevice) => void): void;
    removeEventListener(type: "connected" | "disconnected", cb: (event: Event) => void): void;
  }
}

declare module "@point-of-sale/webserial-receipt-printer" {
  export interface PrinterDevice {
    type: string;
    id: string;
    name?: string;
  }

  export class WebSerialReceiptPrinter {
    constructor(options?: { filters?: Array<{ usbVendorId?: number; usbProductId?: number }> });
    /** Requiere gesto del usuario (clic). */
    connect(): Promise<void>;
    reconnect(device: PrinterDevice): Promise<void>;
    disconnect(): void;
    print(data: Uint8Array): void;
    addEventListener(type: "connected" | "disconnected", cb: (device: PrinterDevice) => void): void;
    removeEventListener(type: "connected" | "disconnected", cb: (event: Event) => void): void;
  }
}
