# Rest — SaaS de Operación para Restaurantes (Perú · LatAm · España)

Punto de venta y operación en la nube para restaurantes independientes (1–5 locales): **PWA offline-first** que corre en cualquier tablet o teléfono barato — POS, pantalla de cocina (KDS), menú QR, pedidos por WhatsApp e impresión térmica — sin contratos, sin hardware propietario y con precio plano por local.

> **Posicionamiento en una frase:** todo lo que hace Loyverse/OlaClick, sin las limitaciones que sus usuarios más critican: offline que funciona de verdad, sin cobro por dispositivo, sin contratos, con los datos del cliente siempre del restaurante.

**Localización:** el producto arranca en **Perú** — `es-PE`, soles (**PEN**, "S/"), teléfonos **+51**, zona horaria `America/Lima`. Fuente única en `packages/types/src/locale.ts`; plantillas de menú y pricing pensados para el mercado peruano.

## Índice de documentación

| Doc | Contenido |
|---|---|
| [resumen-ejecutivo.md](docs/resumen-ejecutivo.md) | Visión, problema, target, posicionamiento, pricing, competencia |
| [roadmap.md](docs/roadmap.md) | 6 fases (0→5), semanas, criterios de salida e hitos de negocio |
| [modulos-features.md](docs/modulos-features.md) | 13 módulos: features básicas vs diferenciadoras, fase y fuente (reseñas/repos) |
| [arquitectura.md](docs/arquitectura.md) | Stack, multi-tenancy, offline-first, impresión térmica, pagos, WhatsApp |
| [diseno-web.md](docs/diseno-web.md) | Design system, layout del admin, wireframes por pantalla, breakpoints |
| [diseno-pwa.md](docs/diseno-pwa.md) | Las 4 superficies PWA (dueño, mesero, cocina KDS, cliente QR) + técnica PWA |

## Decisiones fundamentales (ya tomadas)

1. **Mercado:** Perú primero, luego LatAm + España. WhatsApp es canal core (~80% de las órdenes de comida inician ahí), impresoras térmicas ESC/POS, efectivo, MercadoPago/Stripe.
2. **Stack:** Next.js + TypeScript + Tailwind + shadcn/ui + Postgres + Serwist (PWA). Se reaprovechan boilerplates MIT en vez de construir desde cero.
3. **Wedge (producto de entrada):** POS tablet offline-first + KDS + menú QR desde el mismo catálogo + tickets térmicos. Todo lo demás crece encima.
4. **No reinventar la rueda:** librerías MIT probadas antes que código propio donde el diferencial no está.
5. **Licencias:** los repos AGPL/GPL (URY, satisfecho, ERPNext, mosaic) se usan **solo como referencia de estudio**, nunca como base de código.

## Cómo usar estos documentos

- Para decidir **qué se construye y cuándo** → [roadmap.md](docs/roadmap.md) + [modulos-features.md](docs/modulos-features.md).
- Para **cómo se construye** → [arquitectura.md](docs/arquitectura.md).
- Para **cómo se ve** → [diseno-web.md](docs/diseno-web.md) + [diseno-pwa.md](docs/diseno-pwa.md).

## Estado de implementación — Fases 0–5 ✅ (parciales) · listo para deploy

Monorepo Turborepo con **backend real multi-tenant y las 4 apps conectadas**, verificadas en navegador: login → orden POS → folio → KDS (push en vivo) → cobro → impresión → arqueo → WhatsApp → agregadores → API pública.

**Cerrado en local (fase 1 → producción-ready):**

- ✅ **Impresión térmica real** — encoder ESC/POS (`@point-of-sale/receipt-printer-encoder`) + transports Web Bluetooth / USB / Serial con selector de impresora, test print y reconexión en el POS (`lib/thermal-printer.ts` + picker). Sin impresora: cola honesta en pantalla. *(Red/Node quedó fuera: los transports de browser no incluyen TCP.)*
- ✅ **Cola offline en IndexedDB (Dexie)** — outbox del SyncEngine en `packages/sync/src/dexie-store.ts`, con migración automática one-time desde localStorage y fallbacks (localStorage → memoria).
- ✅ **Service workers Serwist** — precache + runtime caching en pos/kds/menu (`app/sw.ts` por app; el stub manual fue eliminado).
- ✅ **Realtime KDS por SSE** — `GET /api/realtime` (pub/sub en memoria por organización) empuja `orders.changed` desde sync, cobros, WhatsApp y agregadores; el KDS refresca al instante y conserva polling de respaldo (15 s) si el stream cae.
- ✅ **Tests** — 3 suites vitest (36 tests): RLS multi-tenant REAL sobre pglite (un tenant no ve ni escribe filas de otro), motor de sync (idempotencia, backoff, LWW, conflictos) y layout de tickets. `npm test`.
- ✅ **CI** — GitHub Actions (`.github/workflows/ci.yml`): typecheck + tests + build en cada push/PR.
- ✅ **SEO landing** — metadata, canonical, sitemap, robots y JSON-LD (SoftwareApplication, precio PEN).

**Por fase (docs/roadmap.md):**

- **Fase 0 ✅** — Monorepo, auth real con organizaciones, DB Postgres (pglite/Neon) con RLS por rol no-superuser, migraciones Drizzle, CI.
- **Fase 1 ✅** — POS offline-first (Dexie, toggle sin internet, cobro con cambio/propina/mixto, recibo ESC/POS real, corte de caja), KDS en vivo con push, carta QR con pedidos, menú administrable.
- **Fase 2 ✅ (parcial)** — Landing, onboarding self-serve con plantillas + hoja de QRs imprimible, billing con planes (S/ 0 / S/ 129 / S/ 299 por mes) y límite real del free tier, API de catálogo. *Pendiente:* credenciales Stripe/MercadoPago reales (checkout sandbox listo).
- **Fase 3 ✅ (parcial)** — WhatsApp: webhook formato Cloud API de Meta + parser es-PE + auto-respuesta + órdenes a cocina con bandeja e inbox en vivo; reservas públicas; loyalty por teléfono. *Pendiente:* número verificado real de Meta.
- **Fase 4 ✅ (parcial)** — Agregadores (Rappi/Glovo/PedidosYa/Uber Eats) con auto-aceptación + feed unificado + simulador; escandallo con costo teórico y margen; caja de escritorio con arqueo real. *Pendiente:* acuerdos de acceso a APIs de agregadores, terminal de pagos.
- **Fase 5 ✅ (parcial)** — API pública v1 con llaves revocables (Bearer rk_live_…), webhooks del dominio, turnos de staff. *Pendiente:* fiscal (Verifactu/CFDI vía partners), marketplace, i18n multi-locale (hoy es-PE único).

## Demo local

`npm run dev` y entra al panel ([localhost:3000](http://localhost:3000)) con **`maria@cevicheriaelmuelle.pe` / `demo1234`** (Cevichería El Muelle, Lima · slug `cevicheria-el-muelle`); toma una orden en el POS (3001), mírala aparecer **al instante** en el KDS (3002), cóbrala e imprime el ticket (Bluetooth/USB/Serial), y pide desde la carta (3003) o por WhatsApp (simulador en el admin).

```
apps/
  web-admin/   :3000  Panel del dueño — auth real (login/signup con sesión firmada),
                      organizaciones multi-tenant, API completa, dashboard, órdenes
                      (con cobro y boleta), Caja de escritorio (cobrar pendientes,
                      arqueo con totales reales del día, cortes con auditoría),
                      mesas, editor de producto, clientes/loyalty, canales de venta,
                      bandeja WhatsApp, reservas, reportes con export CSV, inventario,
                      staff, configuración (impresoras, pagos, suscripción), landing SEO
  pos/         :3001  POS offline-first: catálogo desde bootstrap, modificadores,
                      descuentos, flujo de cobro completo (efectivo con teclado +
                      cambio, tarjeta, mixto, propina), recibo térmico 58/80mm real
                      (ESC/POS + Web Bluetooth/USB/Serial con picker y test print),
                      órdenes abiertas, corte de caja con arqueo, toggle "sin
                      internet" y cola persistente en IndexedDB (Dexie)
  kds/         :3002  Cocina en vivo: push SSE (/api/realtime) con refetch inmediato,
                      fallback de polling 15s, avance optimista offline-tolerante,
                      bip WebAudio en orden nueva, SLA ≥10 min en rojo
  menu/        :3003  Carta QR con catálogo real, pedido vía SyncEngine (cola
                      persistente en Dexie + reintento) y página pública de reservas
packages/
  db/          Schema Drizzle (16 tablas) + migraciones generadas + Postgres REAL
               embebido (@electric-sql/pglite) con RLS aplicada por rol no-superuser
               (app_runtime + app.tenant_id) — el aislamiento multi-tenant está
               verificado con tests: un tenant NO ve ni escribe filas de otro
  sync/        Motor offline: outbox persistente en IndexedDB (Dexie, con migración
               desde localStorage), HttpSyncTransport, UUID v7 idempotente, backoff,
               LWW + detección de conflictos
  printer/     Capa 1 de tickets: ReceiptDocument + renderReceipt() 58/80mm
               (la capa 2 — encoding ESC/POS + transports — vive en apps/pos)
  types/       Contratos de dominio compartidos (zod) + locale es-PE/PEN
  ui/          Design tokens + componentes (estados suaves, punto de color, no arcoíris)

API (web-admin :3000, CORS para las PWA):
  POST /api/auth/login|signup|logout   · sesión HMAC, scrypt
  GET  /api/bootstrap                  · todo lo que una tablet necesita (cacheable)
  POST /api/sync                       · outbox idempotente: order.create/pay,
                                       · kds.advance, catalog.mark86 → folios definitivos
  GET  /api/realtime?org=<slug>        · SSE: push de orders.changed (KDS en vivo)
  GET  /api/orders?active=1            · cola viva (KDS/POS)
  POST /api/orders/status              · avance de cocina
  GET/POST /api/customers, /api/reservations
```

**Calidad:** `npm test` (vitest: RLS, sync, printer) · `npm run typecheck` · `npm run build` — los tres corren en CI.

## Panel de plataforma (`/superadmin`) — para el dueño del SaaS

Superficie separada del panel de restaurantes, con login del mismo sistema. Features (patrones adaptados de boxyhq/saas-starter-kit y opensaas.sh, ambos MIT): métricas de plataforma (North Star órdenes/semana), lista de tenants con uso real del mes, **suspender/reactivar** (el API completo rechaza al tenant con "contacta a soporte"), cambio de plan, reset de password de clientes, **impersonación auditada** ("entrar como" con actor claim firmado — nunca sobre otro superadmin) y **bitácora de auditoría** de cada acción. El email en `SUPERADMIN_EMAIL` nace superadmin al registrarse en `/signup`; con `SIGNUP_OPEN=false` el registro queda cerrado (nadie se crea cuentas sin tu ok).

## Deploy (dockerizado, plug & play)

Stack de producción completo en `docker-compose.prod.yml` (proyecto `rest-prod`): Postgres 16 sin puertos al host + migrador idempotente (schema + RLS; seed demo solo con `DEMO_SEED=true`) + las 4 apps + Caddy (LAN, puertos altos) + Cloudflare Tunnel opcional para dominio público real. Convive con otros stacks del host sin chocar puertos, y el fix anti-apagado de WSL (`deploy/scripts/configurar-keepalive-wsl.ps1`) mantiene dockerd y los contenedores vivos tras reinicios. **Guía completa:** [deploy/README-DEPLOY.md](deploy/README-DEPLOY.md).

```bash
cp deploy/.env.prod.example .env   # editar credenciales/dominios
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

**Pendiente para deploy real (requiere terceros):** credenciales de Stripe/MercadoPago, número de WhatsApp verificado por Meta, acuerdos con agregadores, terminal de pagos física, fiscal (Verifactu/CFDI vía partners) y i18n si se abren otros mercados. Detalles en [roadmap.md](docs/roadmap.md).
