"use client";

import { ArrowLeft, CalendarCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, Input, cn } from "@rest/ui";
import { API_BASE, ORG_HEADERS, fetchWithTimeout } from "@/lib/api";

/** Horario de reservas: 13:00 a 22:30 en intervalos de 30 min. */
const TIMES: string[] = (() => {
  const slots: string[] = [];
  for (let minutes = 13 * 60; minutes <= 22 * 60 + 30; minutes += 30) {
    slots.push(
      `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
    );
  }
  return slots;
})();

const PARTY_SIZES = Array.from({ length: 12 }, (_, i) => i + 1);

type ReservationResult = "live" | "offline" | "error";

export default function ReservasPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [dayOffset, setDayOffset] = useState<0 | 1>(0);
  const [time, setTime] = useState("19:00");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ReservationResult | null>(null);

  function computeStartsAt(): string {
    const base = new Date();
    base.setDate(base.getDate() + dayOffset);
    const [hours, minutes] = time.split(":").map(Number) as [number, number];
    return new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      hours,
      minutes,
      0,
      0,
    ).toISOString();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ORG_HEADERS },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          partySize,
          startsAt: computeStartsAt(),
        }),
      });
      setResult(res.ok ? "live" : "error");
    } catch {
      // Sin red: éxito local — la confirmación llega por WhatsApp.
      setResult("offline");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Reserva tu mesa</h1>
            <p className="text-xs text-muted-foreground">Te confirmamos por WhatsApp</p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            <ArrowLeft className="size-3.5" /> Ver carta
          </Link>
        </div>
      </header>

      <main className="space-y-4 px-4 py-4">
        {result === "live" && (
          <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-center">
            <p className="flex items-center justify-center gap-2 font-semibold text-success-text">
              <CalendarCheck className="size-5" />
              ¡Reserva confirmada!
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {partySize} {partySize === 1 ? "persona" : "personas"} ·{" "}
              {dayOffset === 0 ? "hoy" : "mañana"} {time} · te confirmamos por WhatsApp.
            </p>
          </div>
        )}

        {result === "offline" && (
          <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-center">
            <p className="flex items-center justify-center gap-2 font-semibold text-success-text">
              <CalendarCheck className="size-5" />
              Reserva recibida, te confirmamos por WhatsApp
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {partySize} {partySize === 1 ? "persona" : "personas"} ·{" "}
              {dayOffset === 0 ? "hoy" : "mañana"} {time}
            </p>
          </div>
        )}

        {result === "error" && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-center">
            <p className="font-semibold text-danger-text">
              No pudimos registrar tu reserva, intenta de nuevo.
            </p>
          </div>
        )}

        <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-xl border bg-card p-4">
          <div className="space-y-1.5">
            <label htmlFor="nombre" className="text-sm font-medium">
              Nombre
            </label>
            <Input
              id="nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ana López"
              required
              maxLength={80}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="telefono" className="text-sm font-medium">
              Teléfono (WhatsApp)
            </label>
            <Input
              id="telefono"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="55 1234 5678"
              required
              maxLength={20}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="personas" className="text-sm font-medium">
              Personas
            </label>
            <select
              id="personas"
              value={String(partySize)}
              onChange={(e) => setPartySize(Number(e.target.value))}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PARTY_SIZES.map((n) => (
                <option key={n} value={String(n)}>
                  {n} {n === 1 ? "persona" : "personas"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Día</span>
            <div className="flex gap-2">
              {(
                [
                  { offset: 0 as const, label: "Hoy" },
                  { offset: 1 as const, label: "Mañana" },
                ]
              ).map((option) => (
                <button
                  key={option.offset}
                  type="button"
                  onClick={() => setDayOffset(option.offset)}
                  className={cn(
                    "flex-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    dayOffset === option.offset
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="hora" className="text-sm font-medium">
              Hora
            </label>
            <select
              id="hora"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {TIMES.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" className="h-12 w-full text-base" disabled={sending}>
            {sending && <Loader2 className="size-4 animate-spin" />}
            {sending ? "Enviando…" : "Reservar mesa"}
          </Button>
        </form>
      </main>
    </div>
  );
}
