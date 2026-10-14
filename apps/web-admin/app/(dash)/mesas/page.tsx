"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@rest/ui";
import { ORG_SLUG } from "@/lib/use-api";

interface MesaApi {
  id: string;
  name: string;
  zone: string;
  status: string;
}

interface ActiveOrder {
  tableId: string | null;
}

interface BootstrapData {
  tables?: MesaApi[];
}

const STATUS_DOTS: Record<string, string> = {
  free: "bg-success",
  occupied: "bg-destructive",
  bill: "bg-warning",
  reserved: "bg-info",
};
const STATUS_LABELS: Record<string, string> = {
  free: "Libre",
  occupied: "Ocupada",
  bill: "Con cuenta",
  reserved: "Reservada",
};

/**
 * Mapa de mesas con estado VIVO: mesas del bootstrap + ocupación calculada
 * desde las órdenes activas (tableId presente = mesa ocupada ahora mismo).
 */
export default function MesasPage() {
  const [tables, setTables] = useState<MesaApi[] | null>(null);
  const [ocupadas, setOcupadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const base = fetch("/api/bootstrap", { headers: { "X-Org-Slug": ORG_SLUG }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: BootstrapData) => {
        if (alive) setTables(data.tables ?? []);
      });
    const orders = fetch("/api/orders?active=1", { headers: { "X-Org-Slug": ORG_SLUG }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { orders?: Array<{ tableId: string | null }> }) => {
        const ids = new Set<string>();
        for (const o of data.orders ?? []) {
          if (o.tableId) ids.add(o.tableId);
        }
        if (alive) setOcupadas(ids);
      });
    void Promise.allSettled([base, orders]);
    return () => {
      alive = false;
    };
  }, []);

  const lista = tables ?? [];
  const zonas = [...new Set(lista.map((t) => t.zone))];
  const ocupadasCount = lista.filter((t) => ocupadas.has(t.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Mesas</h1>
          <p className="text-sm text-muted-foreground">
            {ocupadasCount}/{lista.length} ocupadas ahora mismo
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          {(["free", "occupied", "bill", "reserved"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-muted-foreground">
              <span className={`size-2 rounded-full ${STATUS_DOTS[s]}`} aria-hidden />
              {STATUS_LABELS[s]}
            </span>
          ))}
        </div>
      </div>

      {tables === null && <p className="text-sm text-muted-foreground">Cargando mesas…</p>}

      {tables !== null && lista.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Aún no hay mesas configuradas. Créalas desde el onboarding o agregalas a tu local.
          </CardContent>
        </Card>
      )}

      {zonas.map((zone) => (
        <Card key={zone}>
          <CardContent className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{zone}</p>
            <div className="flex flex-wrap gap-3">
              {lista
                .filter((t) => t.zone === zone)
                .map((t) => {
                  const ocupada = ocupadas.has(t.id);
                  const dot = ocupada ? STATUS_DOTS.occupied : (STATUS_DOTS[t.status] ?? STATUS_DOTS.free);
                  return (
                    <div
                      key={t.id}
                      className="flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-xl border bg-card p-2 text-center shadow-sm"
                      title={ocupada ? "Ocupada: tiene una orden activa" : STATUS_LABELS[t.status] ?? "Libre"}
                    >
                      <span className="text-sm font-semibold">{t.name}</span>
                      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
                      {ocupada && (
                        <span className="text-[10px] text-muted-foreground">con orden activa</span>
                      )}
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      ))}

      <p className="text-xs text-muted-foreground">
        Ocupación calculada en vivo desde las órdenes activas del local. Las reservas asignadas a mesa
        marcan el estado reservado.
      </p>
    </div>
  );
}
