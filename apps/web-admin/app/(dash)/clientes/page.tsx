"use client";

import { Users, MessageCircle, X, Eye, Send, Sparkles, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, Input, cn } from "@rest/ui";
import { fetchApi, ORG_SLUG } from "@/lib/use-api";

import {
  CAMPAIGN_TEMPLATES,
  SEGMENTS,
  daysSince,
  isCustomersResponse,
  LOYALTY_GOAL,
  progressPct,
  relativeVisit,
  segmentOf,
  type Customer,
  type CustomersResponse,
  type Segment,
} from "./data";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** Puntos con progresión hacia la recompensa — barra fina en escala del acento. */
function PointsCell({ points }: { points: number }) {
  const pct = progressPct(points);
  return (
    <div className="min-w-32">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold tabular-nums">{points.toLocaleString("es-PE")}</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">/ {LOYALTY_GOAL}</span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% hacia la recompensa`}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Sheet lateral con el perfil del cliente (datos reales: puntos y última visita). */
function ProfileSheet({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Perfil de ${customer.name}`}>
      <button
        type="button"
        aria-label="Cerrar perfil"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40"
      />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto border-l bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b p-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{customer.name}</h2>
            <p className="text-sm text-muted-foreground">{customer.phone}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X />
          </Button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{segmentOf(customer)}</Badge>
            <Badge variant="outline">
              <Sparkles className="size-3" aria-hidden />
              {customer.loyaltyPoints.toLocaleString("es-PE")} puntos
            </Badge>
            <Badge variant="outline">Última visita: {relativeVisit(customer.lastVisitAt)}</Badge>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Puntos de lealtad
            </p>
            <div className="mt-2">
              <PointsCell points={customer.loyaltyPoints} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            El detalle de visitas por cliente aparecerá cuando las órdenes se vinculen al teléfono del
            cliente (la carta y el WhatsApp ya lo envían).
          </p>
        </div>
      </div>
    </div>
  );
}

/** Modal de campaña WhatsApp: segmento + plantilla — guarda BORRADOR, no envía. */
function CampaignModal({
  customers,
  onClose,
  onSaved,
}: {
  customers: Customer[];
  onClose: () => void;
  onSaved: (segment: Segment, count: number, templateName: string) => void;
}) {
  const [segment, setSegment] = useState<Segment>("Inactivo");
  const [templateId, setTemplateId] = useState(CAMPAIGN_TEMPLATES[0]?.id ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const count = customers.filter((c) => segmentOf(c) === segment).length;
  const template = CAMPAIGN_TEMPLATES.find((t) => t.id === templateId);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Nueva campaña de WhatsApp">
      <button
        type="button"
        aria-label="Cerrar campaña"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40"
      />
      <div className="absolute inset-x-4 top-1/2 mx-auto max-w-lg -translate-y-1/2 rounded-xl border bg-card p-6 shadow-xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Campaña WhatsApp</h2>
            <p className="text-sm text-muted-foreground">Elige el segmento y la plantilla del mensaje.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X />
          </Button>
        </div>

        <fieldset className="mt-5">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Segmento
          </legend>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSegment(s)}
                aria-pressed={segment === s}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  segment === s
                    ? "border-primary bg-primary/10 font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{count} clientes en este segmento</p>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Plantilla
          </legend>
          <div className="space-y-2">
            {CAMPAIGN_TEMPLATES.map((t) => (
              <label
                key={t.id}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                  templateId === t.id ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="campaign-template"
                  className="mt-1 accent-[var(--primary)]"
                  checked={templateId === t.id}
                  onChange={() => setTemplateId(t.id)}
                />
                <span>
                  <span className="block text-sm font-medium">{t.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{t.body}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => template && onSaved(segment, count, template.name)}
            disabled={!template}
          >
            Guardar borrador
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Overlay + card centrada: cierra con Escape o clic fuera. */
function ModalShell({
  titulo,
  descripcion,
  onClose,
  children,
}: {
  titulo: string;
  descripcion: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={titulo}>
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-4 top-1/2 mx-auto max-w-md -translate-y-1/2 rounded-xl border bg-card p-6 shadow-xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
            <p className="text-sm text-muted-foreground">{descripcion}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Alta real de cliente (POST /api/customers). */
function NuevoClienteModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (nuevo: { name: string; phone: string }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const valido = name.trim().length >= 2 && /^\+?[\d\s-]{9,15}$/.test(phone.trim());

  return (
    <ModalShell
      titulo="Nuevo cliente"
      descripcion="Para acumular puntos por teléfono en WhatsApp y la carta."
      onClose={onClose}
    >
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="cli-nombre" className="text-xs font-medium text-muted-foreground">
            Nombre
          </label>
          <Input
            id="cli-nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Jorge Quispe"
            maxLength={40}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cli-telefono" className="text-xs font-medium text-muted-foreground">
            Teléfono (+51…)
          </label>
          <Input
            id="cli-telefono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+51 987 654 321"
            inputMode="tel"
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={!valido}
          onClick={() => onSaved({ name: name.trim(), phone: phone.trim() })}
        >
          Agregar cliente
        </Button>
      </div>
    </ModalShell>
  );
}

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const lista = customers ?? [];
  const [profile, setProfile] = useState<Customer | null>(null);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/customers", { headers: { "X-Org-Slug": ORG_SLUG } })
      .then((r) => r.json())
      .then((data) => {
        if (alive && isCustomersResponse(data)) setCustomers(data.customers);
        else if (alive) setCustomers([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  /** Alta real de cliente (POST /api/customers). */
  const crearCliente = async (nuevo: { name: string; phone: string }) => {
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "X-Org-Slug": ORG_SLUG, "Content-Type": "application/json" },
      body: JSON.stringify(nuevo),
    });
    const resData = (await res.json()) as { ok?: boolean; error?: string };
    setNuevoOpen(false);
    if (!res.ok || !resData.ok) {
      setBanner(resData.error ?? "No se pudo crear el cliente.");
      return;
    }
    setBanner(`Cliente agregado: ${nuevo.name}.`);
    const fresh = await fetch("/api/customers", { headers: { "X-Org-Slug": ORG_SLUG } });
    const data = (await fresh.json()) as CustomersResponse;
    if (isCustomersResponse(data)) setCustomers(data.customers);
  };

  const kpis = useMemo(() => {
    const active30 = lista.filter((c) => {
      const days = daysSince(c.lastVisitAt);
      return days !== null && days <= 30;
    }).length;
    const inactive45 = lista.filter((c) => {
      const days = daysSince(c.lastVisitAt);
      return days === null || days > 45;
    }).length;
    const points = lista.reduce((acc, c) => acc + c.loyaltyPoints, 0);
    return { total: lista.length, points, active30, inactive45 };
  }, [lista]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">CRM y lealtad</p>
        </div>
        <Button variant="outline" onClick={() => setNuevoOpen(true)}>
          <UserPlus aria-hidden />
          Nuevo cliente
        </Button>
        <Button onClick={() => setCampaignOpen(true)}>
          <MessageCircle aria-hidden />
          Campaña WhatsApp
        </Button>
      </div>

      {banner && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success-text"
        >
          <span>{banner}</span>
          <Button variant="ghost" size="icon" onClick={() => setBanner(null)} aria-label="Descartar aviso">
            <X />
          </Button>
        </div>
      )}

      {customers === null && (
        <p className="text-sm text-muted-foreground">Cargando clientes…</p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Clientes" value={kpis.total.toLocaleString("es-PE")} hint="En la base de datos" />
        <Kpi
          label="Puntos emitidos"
          value={kpis.points.toLocaleString("es-PE")}
          hint={`Meta de recompensa: ${LOYALTY_GOAL.toLocaleString("es-PE")}`}
        />
        <Kpi label="Activos 30 días" value={kpis.active30.toLocaleString("es-PE")} hint="Con visita reciente" />
        <Kpi
          label="Inactivos 45+ días"
          value={kpis.inactive45.toLocaleString("es-PE")}
          hint="Candidatos a reactivación"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b px-4 py-3">
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o teléfono…"
            className="max-w-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Puntos</th>
                <th className="px-4 py-3 font-medium">Última visita</th>
                <th className="px-4 py-3 font-medium">Segmento</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(customers ?? [])
                .filter(
                  (c) =>
                    c.name.toLowerCase().includes(busqueda.toLowerCase()) ||
                    c.phone.includes(busqueda),
                )
                .map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.phone}</td>
                  <td className="px-4 py-3">
                    <PointsCell points={c.loyaltyPoints} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{relativeVisit(c.lastVisitAt)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{segmentOf(c)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setProfile(c)}>
                      <Eye aria-hidden />
                      Ver perfil
                    </Button>
                  </td>
                </tr>
              ))}
              {customers !== null &&
                (customers ?? []).filter(
                  (c) =>
                    c.name.toLowerCase().includes(busqueda.toLowerCase()) ||
                    c.phone.includes(busqueda),
                ).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      Sin clientes que coincidan. Se crean solos cuando alguien pide por WhatsApp o la
                      carta, o agrégalos con «Nuevo cliente».
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="size-3.5" aria-hidden />
        Los segmentos se calculan con los puntos y la última visita; el histórico completo llega en F2.
      </p>

      {profile && <ProfileSheet customer={profile} onClose={() => setProfile(null)} />}
      {nuevoOpen && (
        <NuevoClienteModal
          onClose={() => setNuevoOpen(false)}
          onSaved={(nuevo) => void crearCliente(nuevo)}
        />
      )}

      {campaignOpen && (
        <CampaignModal
          customers={lista}
          onClose={() => setCampaignOpen(false)}
          onSaved={(segment, count, templateName) => {
            setCampaignOpen(false);
            setBanner(
              `Campaña "${templateName}" guardada como borrador para ${count} cliente${count === 1 ? "" : "s"} del segmento ${segment} — el envío por WhatsApp llega cuando conectes tu número.`,
            );
          }}
        />
      )}
    </div>
  );
}
