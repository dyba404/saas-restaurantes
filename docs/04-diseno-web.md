# 04 · Diseño Web (Admin + POS desktop)

Aplica a: panel del dueño/gerente (web-admin), configuración, reportes y facturación SaaS. El diseño de las superficies PWA táctiles (POS tablet, KDS, cliente QR) está en [05-diseno-pwa.md](05-diseno-pwa.md).

## Design System

### Base

- **Componentes:** shadcn/ui (heredamos `shadcn-admin` como shell — layout, auth, settings, tablas ya resueltos y MIT).
- **Tipografía:** Inter (o Geist) — 13–14px base en admin (densidad de datos), 16px mínimo en cualquier superficie táctil.
- **Iconos:** Lucide.
- **Gráficas:** Recharts (o Tremor blocks).
- **Tablas:** TanStack Table — ordenadas, filtrables, con sticky header y export CSV.

### Tokens (tema)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `primary` | Tomate/naranja quemado `#E8501A` | `#FF6B35` | Acciones principales, marca (apetito + diferencia del azul genérico SaaS) |
| `neutral` | Zinc | Zinc | Fondos, textos |
| `success` | Verde 600 | Verde 400 | Pagado, abierto, sincronizado |
| `warning` | Ámbar 500 | Ámbar 400 | Pendiente, stock bajo |
| `danger` | Rojo 600 | Rojo 400 | Anulado, error, local caído |
| `info` | Cian 600 | Cian 400 | Estados de canal |

**Dark mode:** obligatorio en POS/KDS (cocinas son oscuras, calurosas y de noche); disponible en admin.

**Densidad:** el admin usa "comfortable" por defecto con toggle a "compact" para reportes (dueños revisan muchas filas).

### Principios de UX del admin

1. **El dueño revisa el negocio desde el teléfono en 30 segundos.** El dashboard mobile-first: hoy, top 5, alertas. El resto es desktop.
2. **Todo mutable tiene undo o confirmación.** Anular una orden pide motivo (insumo del anti-fraude).
3. **Estados siempre visibles:** sincronización, impresora conectada, canales arriba/caídos — en una barra de estado persistente.
4. **Español claro y jerga de restaurante** ("comanda", "corte de caja", "86/agotado"), no jerga de desarrollador.

## Breakpoints y layout

| Rango | Target | Layout |
|---|---|---|
| ≥ 1280px | Desktop | Sidebar fija + contenido máximo 1400px |
| 768–1279px | Tablet landscape | Sidebar colapsada a iconos |
| < 768px | Móvil (dueño) | Bottom nav de 5 items + stacks |

### Shell del admin (desktop)

```
┌────────┬──────────────────────────────────────────────────────────┐
│  LOGO  │  ● Cevichería El Muelle ▾        🔍 buscar…        🔔 3   ⚙️ 👤 │
│        ├──────────────────────────────────────────────────────────┤
│ 📊 Res │                                                          │
│ 🧾 Ord │   [barra de estado: ✅ sincronizado · 🖨️ 2 impresoras ·   │
│ 🪑 Mes │    🟢 Rappi · 🟢 Glovo · ⚠️ WhatsApp: 1 msg sin leer]     │
│ 🍔 Menú│                                                          │
│ 📦 Inv │   ┌───────────── contenido (max 1400px) ─────────────┐   │
│ 👥 Staff│  │                                                    │   │
│ 📅 Res │  │                                                    │   │
│ 📈 Rep │  │                                                    │   │
│ ⚙️ Conf│  └────────────────────────────────────────────────────┘   │
│        │                                                          │
│ 🟢 PRO │  sidebar colapsable ⇤  (tablet → solo iconos)             │
└────────┴──────────────────────────────────────────────────────────┘
```

## Pantallas principales (wireframes)

### 1. Dashboard (la pantalla del dueño)

```
┌ Dashboard ─────────────────────────────────────── Viernes 11 sep ─┐
│                                                                    │
│  Ventas hoy          Tickets         Ticket medio      vs ayer     │
│  $ 48,250  ▲ 12%     132             $ 365             ▲ 9%        │
│                                                                    │
│  ┌ Ventas por hora ─────────────┐  ┌ Top 5 productos ────────────┐ │
│  │        ▂▄▆█▅▃                │  │ 1. Tacos pastor   214  $8.1k│ │
│  │  11  12  13  14  15  16  17  │  │ 2. Cerveza         98  $2.9k│ │
│  └──────────────────────────────┘  │ 3. Gringa          71  $3.2k│ │
│                                    └─────────────────────────────┘ │
│  ┌ Por canal ───────────────────┐  ┌ Alertas ────────────────────┐ │
│  │ POS ██████████ 62%           │  │ ⚠️ Stock bajo: tortillas    │ │
│  │ QR   ███ 18%                 │  │ 🔴 Glovo: menú desactualizado│ │
│  │ WhatsApp ██ 14%              │  │ 💡 14 clientes no vuelven    │ │
│  │ Rappi █ 6%                   │  │    desde hace 45 días →      │ │
│  └──────────────────────────────┘  └─────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

Móvil (dueño): versión apilada con bottom-nav `Inicio · Órdenes · Mesas · Más`.

### 2. Órdenes (tabla viva)

```
┌ Órdenes ────────────────────────── [Hoy ▾] [Canal: Todos ▾] [+ Nueva]┐
│ #0512 14:32  Mesa 4   Mesera Ana    $365  ✅ Pagada   [ver]           │
│ #0513 14:35  Llevar   —             $128  🟡 Pendiente  [cobrar]      │
│ #0514 14:36  QR M7    Cliente W.    $240  🟡 Pendiente  [cobrar]     │
│ #0515 14:38  WhatsApp +52…55   $512  🟡 Pendiente  [cobrar]          │
│ #0510 14:12  Rappi    #88231        $290  ❌ Anulada  motivo: 86       │
│ … TanStack Table: filtros, sticky, export CSV                       │
└──────────────────────────────────────────────────────────────────────┘
```

Detalle de orden: sheet lateral derecho con timeline (creada → comanda impresa → servida → pagada), items y modificadores, acciones con permisos.

### 3. Menú (editor del catálogo)

```
┌ Menú ────────────── [Tacos ▾] [🔍] [+ Producto] [IA: foto → menú] ───┐
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│ │ 📷 foto  │ │ 📷 foto  │ │ 📷 sin   │ │ 📷 foto  │   grid con      │
│ │ Pastor   │ │ Gringa   │ │ foto     │ │ Agua     │   drag & reorder│
│ │ $25 ✓    │ │ $45 ✓    │ │ Bira $60✓│ │ $15 ✓    │                  │
│ │ [86]     │ │ [86]     │ │ [86]     │ │ [86]     │   86 = agotar   │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘   en un toque   │
│                                                                      │
│ Sidebar al editar producto: precio, coste (F4), categorías,          │
│ grupos de modificadores (obligatorio/opcional), disponibilidad,      │
│ traducciones es/en/pt, alérgenos, "ver como cliente" (preview QR)    │
└──────────────────────────────────────────────────────────────────────┘
```

### 4. Mesas (plano del salón)

```
┌ Salón principal ──────────────── 12/20 mesas · Ana: 4 · Luis: 3 ────┐
│   ┌────┐  ┌────┐         ┌─────┐                                    │
│   │ M1 │  │ M2 │         │ M9  │     verde: libre                   │
│   └────┘  └────┘         └─────┘     ámbar: ocupada (min timer)     │
│   ┌────┐  ┌────┐  ┌────┐        azul: con reserva próxima           │
│   │ M3 │  │ M4 ●│  │ M5 │        rojo: cuenta pendiente             │
│   └────┘  └────┘  └────┘                                            │
│   [Terraza] [Barra] (tabs de zonas)   [+ mesa] [editar plano]       │
└──────────────────────────────────────────────────────────────────────┘
```

Drag & drop para diseñar el plano (F2); click en mesa → sheet con cuenta, mesero, tiempo, acciones.

### 5. Reportes

Filtros persistentes (rango, local, canal), gráficas de tendencia + tabla detallada exportable, y comparativa entre locales (F4):

```
┌ Reportes ────────── [Sep 2026 ▾] [Todos los locales ▾] [Exportar ▾]┐
│ Tendencia mensual ▁▃▅▇ · Margen por producto (F4) · Ventas por      │
│ empleado · Horas punta · Reservas vs no-shows · Reporte contador    │
└──────────────────────────────────────────────────────────────────────┘
```

### 6. Configuración

Secciones tipo `shadcn-admin` settings: Negocio (datos, moneda, IVA), Locales, Impresoras (wizard de conexión BT/USB/red con "imprimir prueba"), Pagos, WhatsApp (estado de verificación), Canales (QR, agregadores), Equipo y permisos, Suscripción (plan, uso, **exportar mis datos**, cancelar en un clic — el anti-lock-in es visible aquí).

## Accesibilidad y calidad

- Contraste AA mínimo (AA+ en textos de datos); no usar solo color para estados (icono siempre).
- Targets ≥ 44px en cualquier control que pueda tocarse en tablet.
- Navegación por teclado completa + command palette (⌘K) para usuarios de escritorio.
- Copys en español neutro (adaptable es-PE/es-ES/es-AR con next-intl); números y monedas formateados por locale.
- Performance: dashboard inicial < 150 KB gzip de JS; gráficas lazy.
