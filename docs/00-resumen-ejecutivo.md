# 00 · Resumen Ejecutivo

## Visión

Ser el sistema operativo de los restaurantes independientes de LatAm y España: una PWA que convierte **cualquier tablet Android de $150** en POS + pantalla de cocina, y un QR en cada mesa en canal de pedidos — con precio plano por local, sin contratos y con offline que funciona de verdad.

## El problema (por qué ahora)

Los operadores pequeños enfrentan el mismo abanico de frustraciones, documentadas en reseñas de G2/Capterra/Reddit sobre las plataformas líderes:

| Dolor | Quién lo causa | Fuente de la queja |
|---|---|---|
| Contratos anuales y multas de salida | Toast (contratos 2 años, ~$150/mes de penalización + cobro retroactivo del hardware) | r/ToastPOS, Lavu |
| Hardware propietario caro | Toast (terminales propios), OpenTable/Resy (iPad obligatorio para gestión de mesas) | Comparativas, Eat App |
| Cobro por dispositivo/terminal | Square KDS ($20–30/mes por pantalla), MarketMan ($99/mes/local vía Toast) | Chowly |
| Offline que falla | Square (modo offline automático poco fiable; pagos "aprobados" que luego declinan y Square se deslinda) | Square Community |
| Feature creep con add-ons | KDS, loyalty, inventario y turnos vendidos como suscripciones separadas | Toast/Square ecosystem |
| El restaurante no es dueño de sus datos | OpenTable (datos del comensal), agregadores (datos del cliente) | Pitch explícito de ChowNow/Resy |
| Soporte malo o paywalled | Loyverse (soporte solo pagando), Otter y POSist (soporte lento) | G2, Trustpilot |
| Localización pobre | Square "soporte español limitado" en México; Toast "no recomendado para LATAM" | OlaClick (regional) |

En LatAm/España además: ~80% de los pedidos de comida inician por **WhatsApp**, el efectivo sigue dominando en tickets pequeños, las impresoras térmicas ESC/POS (Bluetooth/USB/red) son el estándar de facto, y los agregadores locales son Rappi/Glovo/PedidosYa/DiDi Food — no DoorDash/Uber Eats.

## Target

**Restaurantes independientes y pequeñas cadenas (1–5 locales)** en México, Colombia, Argentina, Chile, Perú, Ecuador y España: cafeterías, taquerías, pollerías, pizzerías, comida rápida, restaurantes de barrio. Decisor: dueño/gerente. Presupuesto actual: 0–$50/mes (Loyverse gratis, OlaClick free tier, hojas de cálculo, nada).

**No es target en fase 1:** franquicias grandes, hoteles, dark kitchens enterprise.

## Producto

Una sola plataforma, cuatro superficies (todas PWA, cero apps de tienda):

1. **POS** (tablet del local): órdenes con modificadores, descuentos, mesas, efectivo/tarjeta, tickets térmicos, **funciona sin internet**.
2. **KDS** (tablet montada en cocina): cola de órdenes en vivo, estados Preparando/Listo/Servido, suena cuando entra una orden nueva.
3. **Menú QR** (teléfono del cliente): el mismo catálogo renderizado como carta digital + pedidos a mesa o para llevar, sin app, <3s de carga.
4. **Panel del dueño** (móvil/escritorio): ventas del día, top productos, tendencias por hora, comparativa de locales.

Y el canal estrella en la región: **pedidos por WhatsApp** con catálogo, carrito y confirmación automática directo a cocina e impresora.

## Posicionamiento contra la competencia

| | Loyverse | OlaClick | GloriaFood | Fudo | **Rest** |
|---|---|---|---|---|---|
| POS offline | ✔ con límites | Parcial | ✘ | Parcial | **✔ primero del roadmap** |
| KDS | App aparte | ✘ | ✘ | ✔ | **✔ incluido** |
| Menú QR | Básico | ✔ | ✔ | Parcial | **✔ del mismo catálogo** |
| WhatsApp pedidos | ✘ | ✔ | ✘ | Parcial | **✔ fase 3** |
| Precio | Gratis (soporte pago) | Free hasta ~75 órdenes/mes, luego ~$10–25 | Gratis (features pagas) | ~$25/mes | **Freemium + plano por local** |
| Sin cobro por dispositivo | ✔ | ✔ | ✔ | ✔ | **✔ (promesa explícita)** |
| Escandallo/inventario | Básico | ✘ | ✘ | Básico | **Fase 4 (MarketMan tier a precio SMB)** |
| Datos del cliente | Sí | Sí | Sí | Sí | **✔ export garantizado por contrato** |

**Ventaja estructural:** los incumbentes venden apps nativas con suscripciones por dispositivo; nuestra arquitectura PWA hace imposible justificar ese cobro — y lo decimos en voz alta en el marketing.

## Pricing propuesto

- **Gratis:** hasta ~100 órdenes/mes, 1 local, POS + KDS + QR (embudo tipo OlaClick).
- **Pro ~$25–39/mes por local** (precio plano): sin límite de órdenes, WhatsApp, reportes completos, loyalty, reservas. **Sin contratos, cancelación en un clic, export completo de datos.**
- **Multi-ubicación ~$15–20/mes por local adicional:** consola de cadena, menú centralizado con overrides, reportes comparativos.
- **Add-ons de fase 4–5:** agregadores (pedidos Rappi/Glovo integrados), inventario/escandallo, facturación fiscal (Verifactu ES / CFDI MX vía partners).

Principio: **nunca cobrar por dispositivo ni por orden individual**, nunca contratos, nunca retener datos.

## Stack (resumen)

Next.js + TypeScript + Turborepo · Tailwind + shadcn/ui · Postgres (Neon) + Drizzle · Serwist (PWA offline) · IndexedDB/Dexie (cola de órdenes offline) · WebSocket/SSE (KDS en vivo) · Web Bluetooth/USB/Serial → ESC/POS (tickets) · Stripe + MercadoPago · WhatsApp Cloud API · i18n es/en/pt con next-intl.

Detalle completo en [03-arquitectura.md](03-arquitectura.md).

## Riesgos principales

1. **Offline-first es difícil.** Es también el foso defensivo #1: por eso es Fase 1 y no un add-on. Mitigación: patrones probados (outbox, idempotencia) descritos en arquitectura; referencias MIT (FloCafe) para estudiar.
2. **Web Bluetooth no existe en iOS Safari.** La impresión desde iPhone no funcionará vía Bluetooth; soportar impresoras de red y/o gateway. El POS objetivo es Android (donde el mercado ya está).
3. **Fiscal (CFDI/Verifactu)** cambia por país. Fase 5 y vía partners, no builtin.
4. **WhatsApp Cloud API** requiere verificación de negocio por restaurante. Mitigación: guiar el onboarding; alternativa OTOJO/360dialog como BSP.
