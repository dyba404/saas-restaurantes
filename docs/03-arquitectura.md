# 03 · Arquitectura

## Principios

1. **Offline-first**: el POS y el KDS son sistemas locales que sincronizan, no clientes de un API. Si internet se cae, el servicio continúa.
2. **Un catálogo, N canales**: POS, KDS, QR, WhatsApp y agregadores leen del mismo modelo de datos; un cambio propaga a todos.
3. **No reinventar**: boilerplates y librerías MIT primero; código propio solo en el dominio restaurante.
4. **Multi-tenant desde el día 1**: un despliegue, muchos restaurantes, aislamiento por RLS.

## Diagrama general

```
                         ┌─────────────────────────────────────────────┐
                         │                  Vercel                     │
                         │  landing / web-admin / menu-cliente (SSR)   │
                         └───────────────┬─────────────────────────────┘
                                         │
        Tablet POS (PWA) ──────┐         │          ┌────── Tablet KDS (PWA)
        Android, offline ──────┤   ┌─────▼──────┐   │       Android, kiosk
        IndexedDB queue ───────┘   │  Next.js   │   └─────── Teléfono dueño (PWA)
                    │  sync HTTPS  │  API (RSC  │              │ Web Push
                    ▼              │  + routes) │              ▼
          ┌────────────┐          └─────┬──────┘       ┌────────────┐
          │ Impresoras │                │              │ WhatsApp   │
          │ ESC/POS BT │                ▼              │ Cloud API  │
          │ USB / LAN  │     ┌─────────────────────┐   └─────┬──────┘
          └────────────┘     │ Postgres (Neon)     │◀────────┘ webhooks
                             │ tenant_id + RLS     │
                             │ Redis (Upstash):    │      ┌────────────┐
                             │ colas (QStash/      │      │ Agregadores│
                             │ Inngest), realtime  │◀────▶│ Rappi/Glovo│
                             └─────────────────────┘      │ PedidosYa  │
                                                          └────────────┘
                             Pagos: Stripe (ES) / MercadoPago (LatAm)
```

## Monorepo (Turborepo)

```
apps/
  web-admin/      Next.js — panel del dueño/gerente (desktop + tablet)
  pos/            Next.js — POS tablet offline-first (PWA standalone)
  kds/            Next.js — pantalla de cocina (PWA standalone, misma base que pos)
  menu-cliente/   Next.js — carta QR + pedidos (público, ultra-ligero, SEO)
  landing/        Next.js — marketing + registro self-serve (o ruta del web-admin)
packages/
  ui/             shadcn/ui + componentes propios (tokens, botones, tablas)
  db/             Drizzle schema + migraciones + cliente + RLS helpers
  sync/           Motor offline: cola outbox, resolver de conflictos, hooks TanStack
  printer/        ESC/POS: encoder + transporte Web Bluetooth/USB/Serial/LAN
  types/          Tipos y zod schemas compartidos (contratos de API)
  config/         eslint, tsconfig, tailwind preset
```

`pos` y `kds` comparten el 80% del código (catálogo, órdenes, sync, impresión); se separan como apps porque sus rutas críticas, service workers y presupuestos de rendimiento son distintos.

## Stack por capa

| Capa | Elección | Por qué |
|---|---|---|
| Framework | Next.js 15 App Router + React 19 | Ecosistema de boilerplates MIT; RSC para admin/reports |
| Monorepo | Turborepo | Estándar next-forge |
| UI | Tailwind + shadcn/ui + TanStack Table + Recharts | Dashboards MIT listos (`shadcn-admin`, `Kiranism`) |
| Estado cliente | TanStack Query + Zustand | Cacheo de servidor + estado de UI; sync propio en `packages/sync` |
| DB | Postgres en Neon (branching para previews) + Drizzle | SQL puro, RLS nativo, migraciones tipadas |
| Auth | Clerk (o Auth.js) — decisión de F0 | El boilerplate trae Clerk; organizaciones/roles ya resueltos |
| PWA | Serwist (`@serwist/next`) | Sucesor oficial de next-pwa, recomendado por docs de Next.js |
| Offline store | Dexie (IndexedDB) con envoltorio propio | Colas transaccionales en el navegador |
| Realtime | WebSocket propio (Node) + Redis pub/sub, o Ably si se prefiere SaaS | KDS necesita latencia <1s; SSE como fallback simple |
| Jobs/colas | Inngest o QStash (Upstash) | Webhooks de WhatsApp/agregadores, reportes diarios, dunning |
| i18n | next-intl (es/en/pt) | El boilerplate ya lo integra |
| Observabilidad | Sentry + PostHog + Better Stack | Errores, producto, uptime |
| Email | Resend | Boilerplate-friendly |
| Archivos | Vercel Blob o S3 + Cloudflare CDN | Fotos de productos |

## Multi-tenancy

- Modelo: **tenancy compartida** con columna `tenant_id` en todas las tablas del dominio + **Row Level Security** de Postgres (política `tenant_id = current_setting('app.tenant_id')`).
- La organización del boilerplate SaaS = restaurante (tenant); los locales físicos (locations) son hijos del tenant. 1 restaurante = 1 tenant con ≥1 location.
- Tests obligatorios de cross-tenant en CI (intentar leer un tenant B autenticado como A debe fallar).
- Escalado futuro: si un cliente exige aislamiento total, schema-per-tenant o DB dedicada — la capa `db` lo aísla.

## Arquitectura offline-first (el núcleo)

Es la decisión técnica más importante del producto. Patrón **outbox + idempotencia**:

```
Tablet POS (offline)                          Servidor
┌────────────────────────────────┐
│ UI (Zustand)                   │
│   └─ escribe en                │
│ Dexie/IndexedDB:               │
│  - entidades cacheadas (catálogo, mesas)   ── GET /sync/bootstrap ──▶  Postgres
│  - tabla outbox: cada mutación es un  │
│    evento {clientUuid, tipo, payload,  │
│    createdAt, intentos, estado}        │
└──────────────┬─────────────────┘
               │ cuando hay red: POST /sync (lote, en orden)
               ▼
        Servidor: dedupe por clientUuid (unique index) → aplica en tx → devuelve estado canonical
               │
               ▼
        UI reconcilia: replace local por server version, renumera folios server-side
```

Reglas clave:

- **Toda mutación genera un evento con `clientUuid`** (UUID v7). El servidor deduplica con índice único — reintentos nunca duplican una orden.
- **El servidor es la verdad para numeración** (folios de ticket, número de orden): el POS imprime un folio provisional local y el definitivo llega al sincronizar. Los folios fiscales solo se emiten online.
- **Conflictos**: el 99% se resuelve por regla (última escritura por campo en entidades de catálogo; órdenes nunca se "conflictean" porque son append-only). Casos raros (mesa editada en 2 tablets offline) → detector de divergencia que marca la orden para revisión del gerente en vez de fusionar en silencio.
- **Bootstrap y delta-sync**: al abrir, la tablet pide catálogo+mesas+config (compresible, ~100–400 KB); luego delta por `updated_at` cada vez que recupera red. Catálogo cacheado por service worker también (ver [05](05-diseno-pwa.md)).
- **UI siempre honesta**: badge visible "3 órdenes sin sincronizar" (patrón Loyverse, mejorado); nada se borra de la cola sin confirmación del servidor.
- **Reloj local**: usar hora del servidor al sincronizar para métricas; timestamp local solo para orden de eventos.

Esto se implementa una vez en `packages/sync` y lo consumen POS y KDS. Referencias MIT para estudiar el comportamiento: FloCafe (offline POS + sync), KitchenAsty.

## Realtime (KDS y mapas)

- Órdenes nuevas/estados → **WebSocket** server en Node (o Supabase Realtime/Ably como atajo F1) con Redis pub/sub.
- Fallback: **SSE** + polling largo si el WS no conecta (redes de restaurante bloquean WS a veces).
- El KDS funciona igual con el local sin internet cuando la orden viene del POS en la misma red: el POS publica la comanda vía el hub local (la tablet POS hace push al servidor; si no hay internet, fallback: el KDS recibe por broadcast local de la LAN o impresión directa — decidir en F1 con pruebas reales; la impresora de cocina es el fallback garantizado).

## Impresión térmica

- `packages/printer` con **`@point-of-sale/receipt-printer-encoder`** (ESC/POS, StarPRNT, StarLine) — MIT, browser-native.
- Transportes (del propio autor, todos MIT): `WebBluetoothReceiptPrinter` (Android Chrome), `WebUSBReceiptPrinter`, `WebSerialReceiptPrinter`, network (TCP 9100 vía WebSocket gateway).
- Comandos: logo bitmap, texto con estilos, QR nativo, código de barras, corte, apertura de cajón.
- **Cola de impresión** en IndexedDB con reintentos y alerta si la impresora no responde.
- iOS Safari no soporta Web Bluetooth → ruta de red/gateway (F3). El POS objetivo es Android.
- Recibos fiscales: la plantilla cumple requisitos por país (F5 con partners: Verifactu ES, CFDI MX).

## Pagos

- **Fase 1:** efectivo con cálculo de cambio y tarjeta registrada manual (el cobro real ocurre fuera). Cero riesgo regulatorio.
- **Fase 4:** integraciones — **MercadoPago** (Point/Tap API, QR interoperable AR) y **Stripe Terminal** (ES). La plataforma registra la transacción; el dinero nunca pasa por nosotros.
- **Fase 2+:** cobro de pedidos web/QR con Stripe Checkout / MercadoPago Checkout Pro (link de pago).
- Nunca: ser procesador, atar el procesador del restaurante a nuestra suscripción.

## WhatsApp

- **WhatsApp Cloud API** oficial (Meta): números por restaurante, verificación de negocio guiada en onboarding.
- Entrada: webhook de mensajes → parser de carrito (Flows API para UX guiada, o lista de catálogo + replies) → crea orden con canal `whatsapp` → KDS/impresora → respuesta automática con confirmación y (F4) link de pago.
- Plantillas de mensaje aprobadas: confirmación de pedido, reserva confirmada, aviso de mesa lista, campaña de reactivación (F5).
- BSP alternativo (360dialog/OTOJO) si hay fricción de verificación.

## Agregadores (Fase 4)

- Rappi, Glovo, PedidosYa, Uber Eats: oficialmente vía sus APIs de partners (requisito de volumen — planear temprano) o integradores intermediarios regionales si el acceso directo tarda.
- Feed unificado: orden entrante → normalización de items → auto-aceptación configurable → KDS + impresión. Sync de menú saliente (items, precios, agotados/86). Monitor de estado de tienda con alerta si se despublica (concepto "Sentinel").

## Seguridad y cumplimiento

- RLS multi-tenant (arriba) + authn robusta del boilerplate (2FA disponible).
- PIN de staff hasheado (rate-limit por intentos); tablets de local con sesión de dispositivo (device token revocable).
- Backups: PITR de Neon; export completo self-serve por tenant (JSON + CSV) — política de producto.
- Logs de auditoría para acciones sensibles (voids, descuentos > X, cambios de precio) — insumo del módulo anti-fraude F4.
- PCI: no tocamos PAN (pagos delegados en procesadores) — el alcance PCI-DSS se mantiene mínimo.
- Datos personales: aviso de privacidad por país, base legal de marketing con consentimiento explícito (LFPDPPP MX, Ley 1581 CO, RGPD ES).

## Entorno y CI/CD

- Vercel (apps) + Neon (branching por PR) + Upstash (Redis/colas).
- Preview deploys por PR; migraciones Drizzle en pipeline con gates.
- Playwright E2E de flujos críticos: orden offline→sync, impresión simulada, cross-tenant denegado.
- Feature flags (PostHog) para rollout por local — un restaurante piloto recibe features antes.
