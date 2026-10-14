import Link from "next/link";
import { Badge } from "@rest/ui";

export const metadata = { title: "Ayuda" };

const MODULES: Array<{ t: string; desc: string; items: string[] }> = [
  {
    t: "Resumen",
    desc: "Métricas del día: ventas, tickets, ticket medio, propinas, ventas por hora/canal y alertas.",
    items: ["Los datos son reales de tus órdenes sincronizadas."],
  },
  {
    t: "Órdenes",
    desc: "Todas las comandas: abiertas, pagadas y su estado de cocina.",
    items: [
      "Cobra una orden pendiente con «Cobrar».",
      "El folio definitivo llega del servidor (los folios provisionales se reconcilian solos).",
    ],
  },
  {
    t: "Caja",
    desc: "Dinero real del día: cobros por método, arqueo y corte de turno.",
    items: [
      "Cuenta lo físico, compara contra el sistema y cierra turno con auditoría.",
    ],
  },
  {
    t: "Mesas",
    desc: "Mapa de salón/terraza/barra con estados (libre, ocupada, cuenta, reservada).",
    items: ["Se actualiza con la actividad del POS y la carta QR."],
  },
  {
    t: "Menú",
    desc: "Editor de productos, categorías, precios y grupos de modificadores («¿Cómo lo quieres?»).",
    items: [
      "Los cambios se reflejan al instante en POS, carta QR y WhatsApp.",
      "Marca «agotado» (86) y desaparece de todos los canales.",
    ],
  },
  {
    t: "Canales / WhatsApp",
    desc: "Pedidos que entran por WhatsApp y agregadores (Rappi, Glovo, PedidosYa, Uber Eats).",
    items: ["El webhook ya parsea pedidos en español; conecta tu número de Meta cuando lo tengas."],
  },
  {
    t: "Clientes",
    desc: "Historial por teléfono con puntos de loyalty y campañas.",
    items: ["Los clientes se crean solos al pedir por WhatsApp o carta."],
  },
  {
    t: "Inventario / escandallo",
    desc: "Insumos con stock mínimo y recetas: costo teórico y margen por producto.",
    items: ["Cada venta descuenta insumos según la receta."],
  },
  {
    t: "Staff y turnos",
    desc: "Empleados con PIN por local y turnos de la semana.",
    items: ["Los PIN de tablet son independientes del login del dueño."],
  },
  {
    t: "Reportes",
    desc: "Ventas, productos y canales con export CSV.",
    items: ["Filtro por rango de fechas."],
  },
  {
    t: "Configuración",
    desc: "Suscripción/plan, impresoras, pagos y llaves de API.",
    items: ["Las llaves rk_live_… consumen la API pública v1."],
  },
];

const FLUJO = [
  "1. Abre el local (Staff/turnos) y enciende las tablets: POS y KDS se conectan solos.",
  "2. Vende en el POS; cocina avanza en el KDS; la carta QR entra directo a la misma cola.",
  "3. Cobra desde el POS o Caja; el arqueo del cierre cuadra contra el sistema.",
  "4. Revisa Resumen y Reportes; el corte del día queda auditado.",
];

export default function AyudaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Ayuda · Cómo funciona tu panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guía de cada módulo y el flujo diario recomendado.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-bold text-primary">Flujo diario recomendado</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {FLUJO.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {MODULES.map((m) => (
          <section key={m.t} className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{m.t}</h2>
              <Badge variant="secondary">módulo</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {m.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        ¿Dudas con la impresora o las tablets? Cada app (POS, KDS, carta) tiene su
        propia ayuda con el botón <Badge variant="secondary">?</Badge> en pantalla.{" "}
        <Link href="/superadmin" className="underline">
          Ir al panel de plataforma
        </Link>
      </p>
    </div>
  );
}
