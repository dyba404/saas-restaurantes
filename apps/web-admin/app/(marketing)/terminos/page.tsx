import Link from "next/link";

export const metadata = {
  title: "Términos del servicio",
  description: "Términos y condiciones del uso de rest por restaurantes.",
};

/**
 * Plantilla base de términos — REVISAR con abogado antes de venta formal.
 * Orientada a SaaS B2B en Perú (contratación por suscripción mensual).
 */

const SECCIONES: Array<{ t: string; p: string[] }> = [
  {
    t: "1. Qué es rest",
    p: [
      "rest es un sistema de gestión para restaurantes (punto de venta, cocina, carta digital, reservas y reportes) ofrecido como servicio por suscripción. El servicio se presta «tal cual», buscando disponibilidad continua pero sin garantizar que esté libre de interrupciones momentáneas.",
    ],
  },
  {
    t: "2. Cuentas y responsabilidades del restaurante",
    p: [
      "El restaurante es responsable de la veracidad de sus datos, del uso que su personal haga de las cuentas, PINs y dispositivos asignados, y del contenido de su carta y precios publicados.",
      "Los datos de operación generados por el restaurante (órdenes, clientes, reportes) pertenecen al restaurante. El servicio no los comparte con terceros y el restaurante puede solicitar su exportación en cualquier momento.",
    ],
  },
  {
    t: "3. Planes, cobro y suspensiones",
    p: [
      "El servicio se contrata por plan (Gratis, Pro o Multi) con precio y límites publicados. El cobro se realiza por adelantado según el medio de pago acordado.",
      "El no pago habilita la suspensión del servicio previa notificación. Al regularizar el pago, el servicio se reactiva con toda la información intacta.",
    ],
  },
  {
    t: "4. Uso aceptable",
    p: [
      "No se permite usar el servicio para actividades ilícitas, intentar acceder a datos de otros restaurantes, o alterar el funcionamiento del sistema. Las cuentas que lo hagan pueden ser suspendidas.",
    ],
  },
  {
    t: "5. Soporte y disponibilidad",
    p: [
      "El soporte se brinda por el canal publicado en la aplicación. El restaurante es responsable de mantener copias de seguridad de su información contable; el servicio realiza respaldos periódicos de la base de datos.",
    ],
  },
  {
    t: "6. Finalización",
    p: [
      "El restaurante puede cancelar su suscripción en cualquier momento; el servicio pondrá a disposición la exportación de sus datos. El servicio puede terminar el contrato por incumplimiento de estos términos, con aviso previo razonable.",
    ],
  },
  {
    t: "7. Ley aplicable",
    p: [
      "Estos términos se rigen por la legislación de la República del Perú. Cualquier controversia se resolverá ante los juzgados de Lima, salvo acuerdo distinto por escrito.",
    ],
  },
];

export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Términos del servicio</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Última actualización: septiembre 2026 ·{" "}
        <Link href="/privacidad" className="underline">
          Política de privacidad
        </Link>
      </p>

      <div className="mt-8 space-y-6">
        {SECCIONES.map((s) => (
          <section key={s.t}>
            <h2 className="font-semibold">{s.t}</h2>
            {s.p.map((parrafo) => (
              <p key={parrafo.slice(0, 24)} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {parrafo}
              </p>
            ))}
          </section>
        ))}
      </div>

      <p className="mt-10 rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground">
        Este documento es una plantilla base para operar. Para contrataciones formales, revísalo y ajústalo
        con tu asesor legal.
      </p>
    </div>
  );
}
