# 01 · Roadmap

Horizonte: 12 meses, 6 fases. Cada fase tiene criterios de salida medibles — no se avanza sin cumplirlos. El detalle feature-por-feature está en [modulos-features.md](modulos-features.md).

**Métrica North Star:** órdenes procesadas a través de la plataforma por semana.
**Definición de activación (el momento "ajá"):** primera orden tomada en el POS, impresa en térmica y cerrada en el KDS — aunque el local haya estado sin internet.

---

## Fase 0 — Fundaciones (semanas 1–3)

**Objetivo:** plataforma técnica andando en días, no meses, reusando boilerplates MIT.

| # | Trabajo | Reuso |
|---|---|---|
| 0.1 | Monorepo Turborepo + apps (`web-admin`, `pos`, `kds`, `menu-cliente`, `landing`) + packages (`ui`, `db`, `sync`, `printer`, `types`) | Convención next-forge |
| 0.2 | Base SaaS: auth, organizaciones (tenants), roles, landing, emails transaccionales | Fork de `ixartz/SaaS-Boilerplate` (MIT) o `nextjs/saas-starter` + `shadcn-admin` |
| 0.3 | Design system base: tokens, tema, componentes shadcn ajustados al diseño de [04](diseno-web.md) | `shadcn-ui/ui` |
| 0.4 | DB: schema multi-tenant (`tenant_id` + RLS), migraciones Drizzle | Drizzle + Neon branching |
| 0.5 | CI/CD, preview deploys, Sentry, PostHog, i18n (es/en/pt) con next-intl | Vercel + Acciones GitHub |
| 0.6 | E2E smoke con Playwright (login → crear producto) | Playwright |

**Criterios de salida:** deploy a producción de la landing + admin con auth y organizaciones; RLS verificado con tests de cross-tenant.

---

## Fase 1 — MVP "Operación diaria" (semanas 3–10) ⭐ la crítica

**Objetivo:** un restaurante puede operar un servicio completo (abrir caja, tomar órdenes, imprimir comandas, cocinar con KDS, cobrar, cerrar caja) **sin internet y sin pagar nada**.

| # | Trabajo | Fuente del patrón |
|---|---|---|
| 1.1 | **Catálogo**: categorías, productos con foto, modificadores/grupos obligatorios-opcionales, precios, disponibilidad/86 | Modelos de dominio de TastyIgniter (MIT) |
| 1.2 | **POS tablet offline-first**: toma de órdenes rápida por categorías, mesas, descuentos, notas, split/merge de cuenta, retiro | UX Loyverse + patrones FloCafe (MIT) |
| 1.3 | **Motor offline**: cola en IndexedDB (Dexie), outbox con client-UUID idempotente, sync con resolución de conflictos, indicador de sincronización | Arquitectura en [03](arquitectura.md) |
| 1.4 | **Pagos simples**: efectivo con cálculo de cambio, tarjeta manual (monto), mixto | Loyverse (fortaleza en efectivo) |
| 1.5 | **Impresión térmica**: comandas de cocina + recibo cliente vía Web Bluetooth/USB/Serial (ESC/POS), plantillas 58/80mm, impresoras de red | Familia `@point-of-sale` de NielsLeenheer (MIT) |
| 1.6 | **KDS**: kanban en vivo (Nuevas→Preparando→Listo→Servido), sonoro, temporizadores, offline, targets táctiles grandes | Patrones KitchenAsty + mosaic (solo estudio, AGPL) |
| 1.7 | **Staff**: login por PIN por empleado, permisos (cajero/mesero/cocina/gerente), ventas por empleado | Table stakes POS |
| 1.8 | **Corte de caja**: arqueo por método de pago, diferencias, X/Z report | Table stakes POS |
| 1.9 | **Dashboard dueño v1** (web admin): hoy/anayer/semana, top items, por hora, export CSV | Feature más elogiada de POSist (visibilidad real-time del dueño) |
| 1.10 | **PWA install**: manifest, service worker (Serwist), install-to-home-screen guiado | Serwist (MIT) |

**Criterios de salida:** 3 restaurantes piloto operando servicios reales; ≥1 servicio completo sin internet con 0 órdenes perdidas; NPS ≥ 8 en pilotos; métrica de "setup self-serve < 30 min" alcanzada.

**Hitos de negocio:** firma de 3 pilotos (gratis a cambio de feedback semanal y caso de estudio).

---

## Fase 2 — Adquisición y monetización (semanas 10–16)

**Objetivo:** que un dueño pueda registrarse, configurar y empezar a vender sin hablar con nadie — y pagar cuando supere el free tier.

| # | Trabajo |
|---|---|
| 2.1 | **Menú QR público**: carta desde el mismo catálogo, cacheada agresivamente (<3s en 3G, ver [05](diseno-pwa.md)), multi-idioma, alérgenos, QR dinámico re-apuntable por mesa |
| 2.2 | **Pedidos a mesa (QR)**: el cliente pide desde la mesa → comanda a cocina/impresora (servicio a mesa simplificado) |
| 2.3 | **Billing**: Stripe (España) + MercadoPago (LatAm) — suscripción por local, trials, dunning, plan gratuito |
| 2.4 | **Onboarding self-serve**: wizard de setup (crear menú con plantillas por tipo de cocina, imprimir QR, conectar impresora, invitar staff) |
| 2.5 | **Landing + SEO** por ciudad/tipo ("sistema para taquerías", "POS restaurante Bogotá") |
| 2.6 | **Referrals**: un mes gratis por local referido (canal de crecimiento barato en un mercado de recomendación boca-a-boca) |

**Criterios de salida:** conversión self-serve visit→trial ≥ 3%; primer local pago; tiempo setup→primera orden < 30 min medido en analytics; churn mensual < 3% en los pilotos.

---

## Fase 3 — Canales de venta (meses 4–6)

**Objetivo:** capturar demanda externa sin comisiones — el argumento de venta #2 después del POS.

| # | Trabajo | Fuente |
|---|---|---|
| 3.1 | **Pedidos por WhatsApp**: catálogo + carrito (WhatsApp Flows o catálogo + checkout web), confirmación automática → KDS/impresora. Canal core en LatAm/España | OlaClick/Mensajea validan el modelo; Just Eat ya lo hizo en Europa |
| 3.2 | **Link de pago / pedido para llevar**: mini-tienda web white-label (dominio del restaurante), retiro o entrega propia | GloriaFood lo tiene gratis — hay que igualarlo |
| 3.3 | **Reservas lite**: página de reservas del restaurante, lista de reservas del día en el admin, notas del comensal | Lógica de disponibilidad de cal.diy (MIT) |
| 3.4 | **Mapa de mesas v2**: plano del local con estados (libre/ocupada/reservada/cuenta), asignación de mesero | Table stakes de reservas |
| 3.5 | **Loyalty simple**: puntos por teléfono (sin app del cliente) | Modelo Loyverse probado |
| 3.6 | **Web Push**: nueva orden (cocina), orden lista (mesero), resumen diario del dueño | Diferenciador PWA — nadie en el sector lo usa |

**Criterios de salida:** ≥ 30% de los locales activos usando WhatsApp o QR-ordering semanalmente; reservas usadas por ≥ 20% de locales; primer caso de estudio publicado ("reemplazó X comisión de agregadores por mes").

---

## Fase 4 — Integraciones y operación avanzada (meses 6–9)

**Objetivo:** quedarse en el restaurante grande — inventario, agregadores y pagos electrónicos reales.

| # | Trabajo | Fuente |
|---|---|---|
| 4.1 | **Agregadores**: integración Rappi/Glovo/PedidosYa/Uber Eats — órdenes entrantes a un solo feed con auto-aceptación y auto-impresión, sync de menú y agotados, monitor de estado de tienda | Modelo Deliverect/Otter para el long tail |
| 4.2 | **Pagos electrónicos**: MercadoPago Point/Tap (LatAm) y Stripe Terminal (España) integrados al POS; QR interoperable Argentina | Integrar procesadores, nunca serlo (evitar la trampa Toast/Shift4) |
| 4.3 | **Inventario**: conteos, decremento por receta simple, alertas de stock bajo, proveedores/OC básicas | MarketMan tier simplificado |
| 4.4 | **Escandallo (costeo de recetas)**: costo por plato, margen por producto, variación teórica vs real | Gap de mercado: nadie sirve esto al tier Loyverse |
| 4.5 | **Reportes multi-ubicación**: comparativa entre locales, menú centralizado con overrides por local | Dolor #1 de cadenas pequeñas |
| 4.6 | **Auditoría y control**: bitácora de acciones sensibles, devoluciones con motivo, alertas de fraude (voids por empleado) | Dolor de dueños de 2+ locales |

**Criterios de salida:** 5 locales con ≥ 2 agregadores integrados; inventario activo en ≥ 30% de locales pago; primera cadena de 3+ locales pagando tier multi-ubicación.

---

## Fase 5 — Crecimiento y plataforma (meses 9–12)

| # | Trabajo | Fuente |
|---|---|---|
| 5.1 | **CRM + campañas**: base de clientes propia (el argumento anti-OpenTable), segmentos (frecuencia, ticket, inactivos), campañas email + WhatsApp ("te extrañamos", cumpleaños) | ChowNow/Zuppler |
| 5.2 | **Turnos de staff**: calendario simple, turnos publicados por WhatsApp/push, horas vs ventas | 7shifts tier básico — vendido incluido, no aparte |
| 5.3 | **API pública + webhooks**: ecosistema de integraciones (contabilidad, delivery propio) | Marketplace/API de Loyverse como modelo |
| 5.4 | **Fiscal**: Verifactu (España) y CFDI 4.0 (México) vía partners de facturación | Moat regulatorio local |
| 5.5 | **App store propio**: plugins de terceros sobre la API | Modelo Loyverse |
| 5.6 | **Enterprise-lite**: roles avanzados, aprobaciones, presupuesto de compras | Cadenas 5–15 locales |

**Criterios de salida:** MRR objetivo definido por plan de negocio; retención 90-días ≥ 90%; ≥ 2 integraciones de terceros vivas.

---

## Anti-roadmap (lo que NO haremos en 12 meses)

Decir "no" explícito para no diluir:

- **Ser procesador de pagos** (riesgo regulatorio + capital — siempre integrar).
- **Hardware propio** (el punto es "cualquier tablet").
- **App nativa en tiendas** (la PWA es el producto y el argumento comercial).
- **Delivery logístico propio** (solo flat-fee courier si acaso, fase 5+).
- **Hoteles/retail** (tentación de ERPNext — fuera de foco).

## Gantt aproximado

```
              Sem 1---4---8---12---16---20---24---28---32---36---40---44---48
Fase 0 Fund.  ████████
Fase 1 MVP        ████████████████████
Fase 2 Adquis.                        ██████████████
Fase 3 Canales                                    █████████████
Fase 4 Integr.                                                ████████████
Fase 5 Crecim.                                                            ████████████
```

Las fases 2+ se solapan levemente con hardening de la anterior — el equipo mínimo viable es 2 devs full-stack + 1 diseñador (0.5) + fundador en ventas/soporte.
