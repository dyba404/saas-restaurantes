"use client";

import { CalendarDays, Check, ExternalLink, UserX, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, buttonVariants, cn } from "@rest/ui";
import { ORG_SLUG } from "@/lib/use-api";
import {
  PUBLIC_RESERVATIONS_URL,
  isReservationsResponse,
  reservationVariant,
  timeLabel,
  type Reservation,
  type ReservationStatus,
  type ReservationsResponse,
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

function ReservationRow({
  reservation,
  onConfirm,
  onSeat,
  onNoShow,
}: {
  reservation: Reservation;
  onConfirm: () => void;
  onSeat: () => void;
  onNoShow: () => void;
}) {
  const { status } = reservation;
  const canConfirm = status === "pendiente";
  const canSeat = status === "confirmada" || status === "pendiente";
  const canNoShow = status === "confirmada" || status === "pendiente";

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3 font-semibold tabular-nums">{timeLabel(reservation.startsAt)}</td>
      <td className="px-4 py-3">
        <span className="font-medium">{reservation.customerName}</span>
        {reservation.notes && (
          <span className="block text-xs text-muted-foreground">{reservation.notes}</span>
        )}
      </td>
      <td className="px-4 py-3 tabular-nums text-muted-foreground">{reservation.customerPhone}</td>
      <td className="px-4 py-3 tabular-nums">{reservation.partySize}</td>
      <td className="px-4 py-3 text-muted-foreground">{reservation.tableName ?? "—"}</td>
      <td className="px-4 py-3">
        <Badge variant={reservationVariant[status]}>{status}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-1.5">
          {canConfirm && (
            <Button size="sm" variant="outline" onClick={onConfirm}>
              <Check aria-hidden />
              Confirmar
            </Button>
          )}
          {canSeat && (
            <Button size="sm" onClick={onSeat}>
              Sentar
            </Button>
          )}
          {canNoShow && (
            <Button size="sm" variant="ghost" onClick={onNoShow} aria-label={`Marcar no-show de ${reservation.customerName}`}>
              <UserX aria-hidden />
              No-show
            </Button>
          )}
          {!canConfirm && !canSeat && !canNoShow && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function ReservasPage() {
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/reservations", { headers: { "X-Org-Slug": ORG_SLUG } })
      .then((r) => r.json())
      .then((data) => {
        if (alive && isReservationsResponse(data)) setReservations(data.reservations);
        else if (alive) setReservations([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Estados del API (inglés) <-> estados de la UI (español)
  const TO_UI: Record<string, ReservationStatus> = {
    pending: "pendiente",
    confirmed: "confirmada",
    seated: "sentada",
    cancelled: "cancelada",
    no_show: "no-show",
  };

  async function refresh(): Promise<void> {
    const r = await fetch("/api/reservations", { headers: { "X-Org-Slug": ORG_SLUG } });
    const data = (await r.json()) as ReservationsResponse;
    if (isReservationsResponse(data)) setReservations(data.reservations);
  }

  /** PATCH real: el estado queda en la base de datos al instante. */
  const setStatus = async (id: string, status: ReservationStatus) => {
    const TO_API: Record<ReservationStatus, string> = {
      pendiente: "pending",
      confirmada: "confirmed",
      sentada: "seated",
      cancelada: "cancelled",
      "no-show": "no_show",
    };
    const r = await fetch("/api/reservations", {
      method: "PATCH",
      headers: { "X-Org-Slug": ORG_SLUG, "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: TO_API[status] }),
    });
    if (!r.ok) {
      setBanner("No se pudo actualizar la reserva.");
      return;
    }
    await refresh();
  };

  const confirm = async (r: Reservation) => {
    setStatus(r.id, "confirmada");
    setBanner(`Reserva de ${r.customerName} confirmada.`);
  };
  const seat = async (r: Reservation) => {
    setStatus(r.id, "sentada");
    setBanner(`${r.customerName} sentado/a. Mesa asignada desde Mesas.`);
  };
  const markNoShow = async (r: Reservation) => {
    setStatus(r.id, "no-show");
    setBanner(`${r.customerName} marcado/a como no-show.`);
  };

  // Cubiertos = personas esperadas, sin contar canceladas.
  const lista = reservations ?? [];
  const cubiertos = lista
    .filter((r) => r.status !== "cancelada")
    .reduce((acc, r) => acc + r.partySize, 0);
  const noShows = lista.filter((r) => r.status === "no-show").length;
  const next = lista
    .filter((r) => r.status === "confirmada" || r.status === "pendiente")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reservas</h1>
          <p className="text-sm text-muted-foreground">Lista del día · sin cobro por cubierto</p>
        </div>
        <a
          href={PUBLIC_RESERVATIONS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <ExternalLink aria-hidden />
          Ver página pública de reservas
        </a>
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Reservas" value={String(lista.length)} hint="Todos los estados" />
        <Kpi label="Cubiertos" value={String(cubiertos)} hint="Sin contar canceladas" />
        <Kpi label="No-shows" value={String(noShows)} hint="Registrados hoy" />
        <Kpi
          label="Próxima reserva"
          value={next ? timeLabel(next.startsAt) : "—"}
          hint={next ? `${next.customerName} · ${next.partySize} personas` : "Sin pendientes"}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b p-4">
          <CalendarDays className="size-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">Lista de hoy</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Hora</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Personas</th>
                <th className="px-4 py-3 font-medium">Mesa</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    Aún no hay reservas — llegan solas desde la página pública de la carta.
                  </td>
                </tr>
              )}
              {[...lista]
                .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                .map((r) => (
                  <ReservationRow
                    key={r.id}
                    reservation={r}
                    onConfirm={() => void confirm(r)}
                    onSeat={() => void seat(r)}
                    onNoShow={() => void markNoShow(r)}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Las acciones rápidas (confirmar, sentar, no-show) se guardan en la base de datos al instante. El
        recordatorio automático por WhatsApp y la waitlist llegan próximamente.
      </p>
    </div>
  );
}
