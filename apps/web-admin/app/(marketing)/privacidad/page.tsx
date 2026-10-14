import Link from "next/link";

export const metadata = {
  title: "Política de privacidad",
  description: "Cómo rest trata los datos personales de restaurantes y comensales.",
};

/**
 * Plantilla base orientada a la Ley 29733 (Perú) — REVISAR con abogado.
 * El sistema trata: datos del restaurante (dueño/staff), datos de clientes
 * finales (teléfono/nombre/consumo) y bitácoras técnicas.
 */

const SECCIONES: Array<{ t: string; p: string[] }> = [
  {
    t: "1. Quién trata los datos y para qué",
    p: [
      "El operador del servicio (el proveedor de rest) trata los datos personales para prestar el servicio de gestión contratado por el restaurante: operar el punto de venta, la carta digital, los pedidos y reservas, el programa de lealtad y los reportes.",
      "El responsable del tratamiento de los datos de sus clientes finales (nombre, teléfono, historial de consumo) es el restaurante. El proveedor actúa como encargado del tratamiento por instrucciones del restaurante.",
    ],
  },
  {
    t: "2. Qué datos se tratan",
    p: [
      "Del restaurante y su personal: nombre, correo, nombre del personal de piso y sus PINs de acceso, y la información operativa que generan (órdenes, turnos).",
      "De los clientes del restaurante: nombre, teléfono y historial de pedidos, provistos voluntariamente al pedir por carta digital o WhatsApp, o registrados por el propio restaurante.",
      "Técnicos: bitácoras de acceso y auditoría de acciones administrativas, para seguridad del servicio.",
    ],
  },
  {
    t: "3. Base legal y finalidad",
    p: [
      "Los datos se tratan para ejecutar el contrato de servicio, cumplir obligaciones contables del restaurante y brindar soporte. No se venden ni ceden a terceros con fines comerciales.",
    ],
  },
  {
    t: "4. Conservación y eliminación",
    p: [
      "Los datos se conservan mientras exista la relación de servicio y las obligaciones legales aplicables. Al finalizar, el restaurante puede solicitar la exportación de sus datos y la eliminación de los registros operativos, salvo los que deban conservarse por ley.",
    ],
  },
  {
    t: "5. Derechos (Ley 29733)",
    p: [
      "Los titulares pueden acceder, rectificar, actualizar o solicitar la supresión de sus datos personales dirigiéndose al restaurante (para datos de clientes finales) o al canal de soporte publicado (para datos de cuenta del servicio).",
    ],
  },
  {
    t: "6. Seguridad",
    p: [
      "El servicio aplica medidas técnicas razonables: cifrado en tránsito (HTTPS), aislamiento por cliente en la base de datos, respaldos diarios y control de acceso por roles.",
    ],
  },
];

export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Política de privacidad</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Última actualización: septiembre 2026 ·{" "}
        <Link href="/terminos" className="underline">
          Términos del servicio
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
        Este documento es una plantilla base (orientada a la Ley 29733 — Perú). Revísala y ajústala con tu
        asesor legal antes de contrataciones formales.
      </p>
    </div>
  );
}
