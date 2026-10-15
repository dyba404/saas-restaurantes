# 02 · Módulos y Features

Cada módulo lista: features **básicas** (table stakes, lo que todos tienen), features **diferenciadoras** (lo que las reseñas premian o los incumbentes no hacen bien), la **fase** del roadmap en que entra, y la **fuente** (qué reseña o repo lo valida/lo resuelve).

Convención de fases: **F0** fundaciones · **F1** MVP · **F2** adquisición · **F3** canales · **F4** integraciones · **F5** crecimiento.

---

## 1. Catálogo y Menú

La fuente de verdad única: alimenta POS, KDS, QR, WhatsApp y agregadores.

| Tipo | Feature | Fase | Fuente |
|---|---|---|---|
| Básica | Categorías, productos, variantes, fotos, descripciones multi-idioma | F1 | Table stakes |
| Básica | Modificadores: grupos obligatorios (elige 1) y opcionales, con precio extra | F1 | Table stakes (Toast/Square) |
| Básica | Disponibilidad / marcar "86" (agotado) en un toque, propagado a todos los canales al instante | F1 | Table stakes; Deliverect lo hace con agregadores |
| Básica | Precios por día/hora (dayparts): happy hour, menú ejecutivo | F3 | Dayparting de Toast, elogiado en reseñas |
| Diferenciadora | Digitalización de carta existente: foto del menú físico → borrador con IA para editar y publicar | F2 | MENU TIGER lo vende como diferenciador; reduce el setup de horas a minutos |
| Diferenciadora | Un catálogo → carta QR + POS + WhatsApp + agregadores sin duplicar carga | F3–F4 | El pain #1 de Deliverect/Otter bien hecho |
| Diferenciadora | Ingeniería de menú simple: perros/margins por producto (estrellas vs perros) | F4 | Analytics de menú de Toast, paywalled allí |

---

## 2. POS (Punto de Venta tablet)

El corazón. Requisito número uno de los usuarios: **que no se caiga nunca**, con o sin internet.

| Tipo | Feature | Fase | Fuente |
|---|---|---|---|
| Básica | Órdenes dine-in/llevar con modificadores, notas, cantidades | F1 | Table stakes |
| Básica | Descuentos (%, monto, por ítem o cuenta) con permisos | F1 | Table stakes |
| Básica | Split/merge de cuentas, pago parcial | F1 | Seat-level splitting es lo que reseñas premian de Toast |
| Básica | Efectivo con cálculo de cambio, tarjeta manual, mixto | F1 | Efectivo dominante en LatAm; fortaleza de Loyverse |
| Básica | **Offline total**: abrir caja, ordenar, imprimir comanda, cobrar en efectivo sin internet; sync al volver | F1 | "Cloud POS muere sin internet" = queja #1 de Square Community; Loyverse demuestra que se puede |
| Básica | Login por PIN, ventas por empleado | F1 | Table stakes |
| Básica | Corte de caja / arqueo con diferencias | F1 | Table stakes |
| Diferenciadora | Cualquier tablet Android barata, no hardware propietario — promesa explícita de producto | F1 | Ataque directo a Toast (hardware caro, cotización obligatoria) |
| Diferenciadora | Sin cobro por dispositivo: 1 licencia por local, N tablets | F1 | Ataque a Square KDS ($20–30/mes por pantalla) |
| Diferenciadora | Impresión térmica desde el propio navegador (Web Bluetooth/USB/Serial), sin apps ni drivers | F1 | Familia `@point-of-sale` (MIT); casi ningún OSS lo hace bien |
| Diferenciadora | Modo mesero en el mismo POS: tomar pedido en mesa con el teléfono y enviar directo a cocina | F2 | Diferencial vs cajas de escritorio tradicionales (SoftRestaurant) |

---

## 3. KDS (Pantalla de Cocina)

| Tipo | Feature | Fase | Fuente |
|---|---|---|---|
| Básica | Kanban en vivo: Nuevas → Preparando → Listo → Servido, un toque para avanzar | F1 | Patrones KitchenAsty / mosaic / satisfecho |
| Básica | Alerta sonora + visual al entrar orden nueva (incluye órdenes de WhatsApp/QR/agregadores) | F1 | satisfecho lo hace con WebSocket + sonido |
| Básica | Temporizadores por orden (aviso al exceder SLA), colores por antigüedad | F1 | Estándar KDS |
| Básica | Filtros: por tipo de orden, por estación (parrilla/fritura/postres) | F2 | Mosaic enruta impresoras por cocina |
| Básica | Funciona offline en la red local (las órdenes llegan por el POS aunque no haya internet) | F1 | Eats365 vende esto como feature premium; aquí es base |
| Diferenciadora | Es la misma PWA instalada en una tablet — no licencia extra ni suscripción por pantalla | F1 | Ataque directo al cobro por dispositivo de Square |
| Diferenciadora | "Recall" de tickets servidos del día (reclamaciones) | F2 | Estándar KDS hardware |

---

## 4. Pagos

| Tipo | Feature | Fase | Fuente |
|---|---|---|---|
| Básica | Efectivo (cambio calculado), tarjeta manual (registrada, cobrada fuera), mixto | F1 | Table stakes |
| Básica | Recibo electrónico (QR/WhatsApp) además del impreso | F2 | Estándar |
| Diferenciadora | MercadoPago Point/Tap integrado (LatAm): cobra en la tablet con QR interoperable o NFC del teléfono | F4 | MercadoPago = mayor agregador MX; QR interoperable AR (Transferencias 3.0) |
| Diferenciadora | Stripe Terminal (España) para tarjeta física | F4 | Stripe estándar en ES |
| Diferenciadora | **Nunca ser procesador ni atar pagos a la suscripción** | — | La trampa Toast/Shift4: multa de salida de $16k documentada |
| Básica | Propina configurable (nueva feature solo si entra a España, donde es habitual dejarla; opcional en LatAm) | F4 | Table stakes US/ES |

---

## 5. Impresión Térmica

En LatAm/España no es opcional: la comanda impresa es sagrada en cocina y el recibo fiscal a veces obligatorio.

| Tipo | Feature | Fase | Fuente |
|---|---|---|---|
| Básica | ESC/POS 58mm y 80mm: comandas de cocina (por estación) y recibos de cliente | F1 | Estándar de facto regional |
| Básica | Transportes: Bluetooth (Android), USB, red (Wi-Fi/LAN), Serial | F1 | `@point-of-sale/receipt-printer-encoder` + drivers Web Bluetooth/USB/Serial (MIT) |
| Básica | Plantillas configurables: logo, header/footer fiscal, QR de encuesta, corte automático, cajón de dinero | F2 | Table stakes |
| Diferenciadora | Cola de impresión con reintento: si la impresora está apagada, la comanda queda en cola y avisa | F2 | El "paper jam silencioso" es una pesadilla conocida |
| Diferenciadora | Fallback gateway: si el navegador no soporta Bluetooth (iOS), imprimir vía impresora de red o mini-gateway | F3 | Cobertura iOS sin romper la promesa PWA |

---

## 6. Mesas y Salón

| Tipo | Feature | Fase | Fuente |
|---|---|---|---|
| Básica | Mapa de mesas simple: estados libre/ocupada/cuenta pendiente | F1 | Table stakes |
| Básica | Abrir cuenta por mesa, unir/split, transferir a otra mesa/mesero | F1 | Table stakes |
| Diferenciadora | Plano visual editable (drag & drop de mesas/zonas) | F2 | "Floor plans absent" en Square = queja documentada |
| Básica | Reservas lite: página pública de reservas + lista del día en admin, notas de comensal | F3 | cal.diy (MIT) para lógica de disponibilidad |
| Diferenciadora | Reservas **sin cobro por cubierto** ni iPad obligatorio — web/PWA puro | F3 | Ataque directo a OpenTable ($1–1.50/cubierto, iPad-bound) |
| Diferenciadora | Waitlist con aviso por WhatsApp al liberarse mesa | F3 | Resy lo hace por SMS; WhatsApp es el canal regional |

---

## 7. Canales: QR · WhatsApp · Delivery

| Tipo | Feature | Fase | Fuente |
|---|---|---|---|
| Básica | **Menú QR**: carta digital desde el catálogo, por mesa/zona, multi-idioma, alérgenos | F2 | GloriaFood demuestra que puede ser free-tier |
| Diferenciadora | **Velocidad extrema**: <3s hasta ver la carta en 3G, funciona con el Wi-Fi saturado del local (service worker cache) | F2 | Mr Yum: "primera orden en 30 segundos" es SU producto entero |
| Básica | Pedido a mesa por QR (sin login del cliente) → cocina | F2 | satisfecho: `/menu/{table_token}` |
| Básica | **Pedidos por WhatsApp**: catálogo + carrito + confirmación → KDS/impresora | F3 | ~80% de órdenes LatAm inician en WhatsApp; OlaClick/Mensajea validan |
| Básica | Mini-tienda white-label para llevar/entrega propia, link de pago | F3 | GloriaFood/ChowNow: comisión cero |
| Diferenciadora | **Agregadores en un solo feed**: Rappi/Glovo/PedidosYa/Uber Eats con auto-aceptación, auto-impresión, sync de menú y agotados, luz de estado por plataforma | F4 | Otter/Deliverect para el long tail; el problema de la "granja de tablets" |
| Diferenciadora | Monitor de tienda: alerta si un canal se cae o se despublica | F4 | Concepto "Sentinel" de Deliverect |
| Diferenciadora | **Los datos del cliente son del restaurante** (siempre exportables) | — | El pitch entero de ChowNow; anti-OpenTable/agregadores |

---

## 8. Inventario y Costeo

| Tipo | Feature | Fase | Fuente |
|---|---|---|---|
| Básica | Conteos de inventario, decremento simple por producto vendido | F1 | Loyverse básico |
| Básica | Alertas de stock bajo por producto/ingrediente | F1 | Table stakes |
| Básica | Proveedores y órdenes de compra básicas | F4 | MarketMan tier |
| Diferenciadora | **Escandallo**: recetas con ingredientes, costo teórico por plato, margen real vs teórico | F4 | Gap de mercado: MarketMan $199/mes, xtraCHEF solo-Toast — nadie sirve el tier SMB |
| Diferenciadora | Captura de facturas de proveedor (foto → datos) con flujo a costos | F5 | xtraCHEF best-in-class; simplificar a SMB |

---

## 9. Staff y Turnos

| Tipo | Feature | Fase | Fuente |
|---|---|---|---|
| Básica | Empleados con PIN, roles y permisos granulares | F1 | Table stakes |
| Básica | Clock-in/out y ventas por empleado | F1 | Loyverse/Square |
| Básica | Turnos: calendario simple, publicación, swap con aprobación | F5 | 7shifts básico |
| Diferenciadora | Turnos **incluidos** en la suscripción, no como producto aparte | F5 | Queja recurrente: pagar 3 suscripciones (POS + scheduling + payroll) |
| Diferenciadora | Publicación de turno por WhatsApp/push al staff | F5 | Canal regional |

---

## 10. Loyalty y CRM

| Tipo | Feature | Fase | Fuente |
|---|---|---|---|
| Básica | Puntos por teléfono (sin app del cliente): acumular/redimir en el POS | F3 | Modelo Loyverse probado; su queja era forzar app — aquí no |
| Diferenciadora | CRM propio: historial por cliente, segmentos (frecuencia, ticket medio, inactivos) | F5 | ChowNow/Resy: dueño de datos |
| Diferenciadora | Campañas email + WhatsApp (reactivación, cumpleaños, promos) con plantillas | F5 | Zuppler AI upselling, simplificado |
| Básica | Cupones y promos (2x1, %, primer pedido) en todos los canales | F3 | Table stakes |

---

## 11. Reportes y Dashboard

| Tipo | Feature | Fase | Fuente |
|---|---|---|---|
| Básica | Hoy/ayer/semana: ventas, tickets, ticket medio, por hora | F1 | Visibilidad real-time del dueño = lo más elogiado de POSist |
| Básica | Top productos, ventas por categoría/canal/empleado | F1 | Table stakes |
| Básica | Export CSV/Excel de todo, siempre | F1 | Promesa de producto |
| Básica | Push/push-report diario al teléfono del dueño | F3 | Web Push: diferenciador PWA |
| Diferenciadora | Reportes multi-ubicación comparativos (ventas, margen, faltantes por local) | F4 | Dolor #1 de cadenas pequeñas (ClicData/HungerRush) |
| Diferenciadora | Reportes fiscales/contables preparados para el contador (ES/MX) | F5 | Localización como moat |

---

## 12. Multi-ubicación (Cadena)

| Tipo | Feature | Fase | Fuente |
|---|---|---|---|
| Básica | Selector de local, roles por local, un login para todos | F1 | Table stakes |
| Diferenciadora | Consola de cadena: menú centralizado con overrides por local, precios/86 propagados | F4 | Pain central de franquicias pequeñas |
| Diferenciadora | Comparativa de locales en un dashboard | F4 | ClicData/HungerRush validan la demanda |

---

## 13. Plataforma SaaS (lo que el boilerplate ya trae)

| Tipo | Feature | Fase | Fuente |
|---|---|---|---|
| Básica | Auth (email/social), organizaciones = restaurantes, invitaciones por rol | F0 | `ixartz/SaaS-Boilerplate` (MIT) |
| Básica | Billing con trials, planes, dunning | F2 | Stripe + MercadoPago; boilerplate ya trae Stripe |
| Básica | i18n es/en/pt, emails transaccionales, landing | F0/F2 | Boilerplate + next-intl |
| Básica | Admin interno del SaaS: métricas MRR/churn, impersonar local para soporte | F2 | open-saas.sh como referencia |
| Diferenciadora | Soporte in-app con chat + "impersonar con permiso" para diagnosticar de noche | F3 | Loyverse cobra el soporte — convertirlo en diferenciador |
| Diferenciadora | Export total de datos self-serve en un clic | F2 | Anti-lock-in como política, no como favor |
