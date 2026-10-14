export const metadata = { title: "Ayuda" };

const ACCIONES: Array<{ t: string; items: string[] }> = [
  {
    t: "Restaurantes (tenants)",
    items: [
      "Suspender: el restaurante deja de operar AL INSTANTE (POS, KDS, carta y WhatsApp reciben «contacta a soporte»). Reactivar lo devuelve al instante.",
      "Plan: free (100 órdenes/mes), pro (5.000), multi (50.000) — el API bloquea nuevas órdenes al llegar al límite.",
      "Órdenes/mes: uso real del mes — tu base para cobrar.",
    ],
  },
  {
    t: "Detalle de un restaurante → Usuarios",
    items: [
      "Reset password: genera una temporal (se muestra UNA vez) — úsala para dar acceso nuevo al dueño.",
      "Quitar acceso: saca al usuario de ESE restaurante (la cuenta sigue existiendo).",
      "Entrar como: impersonación para soporte — ves el panel exactamente como el dueño; queda auditada y sales con «Volver a mi sesión».",
    ],
  },
  {
    t: "Dispositivos (tablets)",
    items: [
      "Crear dispositivo genera un TOKEN que se muestra UNA vez: pégalo en la tablet (POS/KDS/carta lo piden al iniciar si DEVICE_AUTH=true).",
      "Revocar: la tablet deja de operar al instante (útil ante robo o cambio de equipo).",
      "«Última conexión» te dice si la tablet está operando.",
    ],
  },
  {
    t: "Auditoría",
    items: [
      "Todo lo que hagas aquí queda registrado: quién, qué, cuándo y sobre qué. Es tu defensa ante cualquier disputa.",
    ],
  },
  {
    t: "Resumen",
    items: [
      "Órdenes/semana es tu métrica North Star; órdenes/mes tu base de facturación; el top 30 días muestra qué tenants crecen.",
    ],
  },
];

export default function SuperadminAyudaPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Ayuda · Panel de plataforma</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Qué hace cada acción y cuándo usarla. Todo queda en la auditoría.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {ACCIONES.map((a) => (
          <section key={a.t} className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-semibold">{a.t}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {a.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
