# 05 · Diseño PWA (Móvil y Tablet)

Una sola tecnología (PWA), **cuatro superficies por rol**. Ninguna pasa por tiendas: se instalan desde el navegador a la pantalla de inicio (install-to-home-screen), lo que elimina el cobro "por dispositivo" de los incumbentes.

| Superficie | Dispositivo | Documento apuntado a | Crítica de UX |
|---|---|---|---|
| **POS** (mesero/cajero) | Tablet Android 8–11" + teléfono | `pos.restapp.com` | Velocidad: 3 toques para una orden |
| **KDS** (cocina) | Tablet Android barata montada | `kds.restapp.com` | Legible a 2 metros, de noche, con manos grasas |
| **Dueño** | Teléfono + desktop | `app.restapp.com` | El negocio en 30 segundos |
| **Cliente QR** | Teléfono del comensal | `m.restapp.com/{tenant}/menu` | Carta en <3s, pedido en <60s, sin app, sin login |

## Técnica PWA (común)

- **Serwist** (`@serwist/next`): precache del app shell + runtime caching por ruta.
- **Manifest** por superficie: `display: standalone`, orientación (POS: cualquiera; KDS: landscape lock), theme color por rol, iconos maskable 192/512.
- **Estrategias de caché (Serwist routes):**

| Recurso | Estrategia | Por qué |
|---|---|---|
| App shell (JS/CSS de POS/KDS) | Precache + stale-while-revalidate | Arranque instantáneo sin red |
| Catálogo/menú del local | Cache-first con revalidación en background | La carta QR abre aunque el Wi-Fi del local esté saturado (el benchmark de Mr Yum) |
| API de órdenes (GET) | Network-first con fallback a caché | Datos frescos si hay red, siempre visibles si no |
| Mutaciones (POST órdenes) | Nunca cachear → cola Dexie + Background Sync | Ver [03-arquitectura.md](03-arquitectura.md) |
| Fotos de productos | Cache-first, AVIF/WebP, LRU | Ancho de banda de móviles 3G/4G |

- **Web Push (VAPID):** nueva orden → cocina; orden lista/cobrar → mesero; resumen diario + alertas (stock, canal caído) → dueño. Permiso pedido en contexto (no en la primera visita).
- **Wake Lock API** en KDS y POS: pantalla siempre encendida durante servicio.
- **Background Sync** para reenviar la cola outbox al recuperar red, con badge visible de pendientes.
- **Instalación:** botón propio con `beforeinstallprompt` dentro del onboarding ("Paso 3: instala la app en tu tablet"); detectar standalone con `display-mode`.
- **Tablets Android baratas (2GB RAM, Android 9–11):** presupuesto de memoria estricto, sin animaciones pesadas, imágenes limitadas, probar en dispositivo de $150 — es el dispositivo objetivo real del mercado.
- **Kiosk (cocina):** guía para modo quiosco de Android (pantalla fija, auto-arranque), sin pagar MDM.

---

## Superficie 1 — POS (tablet del mesero/cajero)

### Wireframe: toma de orden

```
┌────────────────────────────────────────────────────────────────────┐
│ 12:34  ● Ana (PIN ok)      Mesa 4 ▾   Llevar ▾    🖨️ ✓   🌐 sync ✓ │  ← barra: contexto, impresora, sync
├───────────────────────────────────────────────┬────────────────────┤
│  [Buscar 🔍]  ● Tacos ● Bebidas ● Postres ● … │  MESA 4 · Ana      │
│                                               │ ─────────────────  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │ 3× Pastor          │
│  │ Pastor │ │ Gringa │ │ Campe- │ │ Arra-  │  │    · sin cebolla   │
│  │  $25   │ │  $45   │ │ chano  │ │ chera  │  │ 1× Gringa          │
│  └────────┘ └────────┘ │  $38   │ │  $30   │  │    · +queso $10    │
│  ┌────────┐ ┌────────┐ └────────┘ └────────┘  │ 2× Agua horchata   │
│  │ Agua   │ │ Coke   │ ┌────────┐ ┌────────┐  │ ─────────────────  │
│  │  $15   │ │  $20   │ │ Volte- │ │ Queso  │  │ Subtotal     $178  │
│  └────────┘ └────────┘ │ ano…   │ │ …      │  │ Descuento        0 │
│  (targets ≥64px, 2–4 columnas según    │  │ TOTAL        $178  │
│   tablet; 86 = tarjeta atenuada)       │  │ [Enviar a cocina]  │  ← botón gigante primario
│                                        │  │ [Cobrar] [Nota]    │  ← cobrar abre pagos
├────────────────────────────────────────┴──┤                    │
│ [Mesas] [Órdenes abiertas] [Caja] [Menú]  │ (flujo pago: efectivo con
└───────────────────────────────────────────┘  teclado de cambio, tarjeta, mixto)
```

**Reglas de UX:**
- Máximo **3 toques** para ordenar un producto con modificador obligatorio (producto → opción → mandar).
- Modificadores como chips grandes; notas con voz→texto (teclado dictado nativo).
- Sin internet: todo funciona igual; badge `● 2 sin sincronizar` en la barra; folio provisional `L-0412` que se convierte en definitivo al sync.
- "86" en un toque desde el propio POS (atenuar producto).
- Split de cuenta: arrastrar ítems entre cuentas; cobrar por separado.
- Botones destructivos (anular) con confirmación + motivo + permiso.

### Wireframe: mesero con teléfono (F2, misma app responsive)

```
┌───────────────┐   Mesas (grid compacto, estado por color)
│ ● Mesa 3  12m │→ tap → toma pedido con los mismos componentes
│ ● Mesa 4  34m │   en columnas de 1; enviar a cocina con un botón
│ ○ Mesa 5      │
└───────────────┘
```

---

## Superficie 2 — KDS (cocina, tablet montada)

```
┌──────────────────────────────────────────────────────────────────────┐
│ KDS · Cocina principal      12:34  ● sin internet OK   🔔 sonido ON  │
├──────────────────┬──────────────────┬──────────────────┬──────────────┤
│ NUEVAS (2)       │ PREPARANDO (3)   │ LISTAS (1)       │ SERVIDAS hoy │
│                  │                  │                  │              │
│ ┌──────────────┐ │ ┌──────────────┐ │ ┌──────────────┐ │  (compacto,  │
│ │ #0512 · M4   │ │ │ #0510 · Llevar│ │ │ #0508 · M1  │ │   colapsable)│
│ │ 12:31 ⏱ 3:24 │ │ │ 12:22 ⏱ 12:40│ │ │ 12:10 ⏱ done│ │              │
│ │ ───────────  │ │ │ ⚠️ EXCEDE SLA │ │ │ ──────────  │ │              │
│ │ 3× Pastor    │ │ │ ───────────  │ │ │ 2× Pollo    │ │              │
│ │   sin cebolla│ │ │ 2× Gringa    │ │ │ 1× Ensalada │ │              │
│ │ 1× Gringa    │ │ │ 1× Volteado  │ │ └──────────────┘ │              │
│ │ 2× Agua horch│ │ │ ⚠️ nota roja │ │  [Llamar mesero] │              │
│ │              │ │ └──────────────┘ └──────────────────┤              │
│ │ [COCINAR]    │ │  [LISTO]                            │              │
│ └──────────────┘ │  (un toque gigante por tarjeta)     │              │
└──────────────────┴──────────────────────────────────────────────────┘
   Rojo si pasa SLA · tarjetas amarillas al acercarse · entran con sonido
```

**Reglas de UX:**
- Legible a 2 m: número de orden y SLA en ≥32px; tarjetas ≥120px de alto; un solo botón grande por estado.
- **Órdenes de todos los canales** (POS, QR, WhatsApp, agregadores F4) con insignia de canal.
- Sonido diferenciado: nueva orden (campana) vs excede SLA (zumbido). Volumen configurable.
- Filtros por estación (parrilla/fritura/postres) — cada estación puede tener su tablet.
- Modo oscuro por defecto; contraste AA+; bloqueo de pantalla (Wake Lock) + modo quiosco.
- Offline: las órdenes del POS siguen llegando en LAN (ver arquitectura); nunca queda "en blanco".

---

## Superficie 3 — Dueño (móvil)

```
┌─────────────────────┐   Pantalla única con lo que importa:
│ Hoy        $48,250  │   1. Números del día vs ayer
│            ▲ 12%    │   2. Gráfica por hora
│ ▂▄▆█▅▃              │   3. Top 5 productos
│ Tickets 132 · $365  │   4. Alertas (stock, canales, cajas abiertas)
│ ──────────────────  │   5. Órdenes en vivo (opcional, en vivo)
│ 1. Pastor   214     │   6. Últimos movimientos sensibles (voids)
│ 2. Cerveza   98     │
│ ⚠️ Tortillas bajas  │   Push diario 22:00: "Hoy vendiste $48,250,
│ ⚠️ Caja 1 sin cerrar│   ▲12% vs la semana pasada. 132 tickets."
│ [Ver órdenes] [Más] │
└─────────────────────┘
```

Multi-local (F4): selector arriba, comparativa entre locales como segunda pestaña.

---

## Superficie 4 — Cliente QR (teléfono del comensal)

El benchmark es Mr Yum: **primera orden en 30 segundos**. Cada kilobyte cuenta.

```
┌──────────────────────┐
│ TAQUERÍA EL SOL   es ▾│  ← 1ra pantalla: carta completa, fotos lazy,
│ ──────────────────── │     categories sticky, búsqueda local
│ ●Tacos ●Bebidas ●Más │
│ ┌────────┐┌────────┐ │  ← cartas cacheadas por service worker:
│ │ Pastor ││ Gringa │ │     abre en <3s incluso con Wi-Fi saturado
│ │ $25    ││ $45    │ │
│ │[+ ]    ││[+ ]    │ │
│ └────────┘└────────┘ │
│        ┌────────────┐│
│        │🛒 3 · $115 ││  ← barra de carrito flotante (sticky)
│        │   Ver ▸    ││
└────────┴────────────┴┘

Checkout (mesa M7, sin login): nombre (opcional) → confirmar →
"Tu pedido está en cocina ✅" → (F3) Estado en vivo + opción
[Pedir por WhatsApp] como canal alternativo.
```

**Reglas de UX:**
- **Sin login, sin descarga, sin flash de entrada.** Server-render + cache SW.
- Multi-idioma por `?lang=` / aceptación del navegador; alérgenos visibles.
- Pago desde el teléfono (F3–F4): MercadoPago/Stripe link; la mesa pide "cuenta" al POS.
- Accesible (AA), funciona en pantalla pequeña, tamaño de fuente grande por defecto.
- QR por mesa con token (`/menu/el-sol?mesa=7`) re-apuntable sin reimprimir (QR dinámico).

## Medición de éxito de diseño

| Métrica | Objetivo |
|---|---|
| Tiempo carta QR visible (3G, móvil medio) | < 3s |
| Tiempo orden simple en POS (producto simple) | < 10s, 3 toques |
| Arranque POS/KDS instalado (frío) | < 2s |
| Órdenes perdidas en corte de internet de 1h | 0 |
| Tasa de finalización de pedido QR | > 70% de carritos iniciados |
