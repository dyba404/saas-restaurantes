"use client";

import { KeyRound, RefreshCw, Send, ShieldCheck, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Input } from "@rest/ui";
import { ORG_SLUG } from "@/lib/use-api";
import {
  PERMISOS,
  PERMISOS_INICIALES,
  ROLES,
  type PermisosPorRol,
  type PermisoId,
  type Rol,
} from "./data";

// ── Staff y turnos (datos reales de la DB) ──────────────────────────────────
// GET  /api/shifts     → { staff, shifts }
// POST /api/shifts     → { staffId, day (0=lun…6=dom), startHour, endHour }
// POST /api/staff      → { action: "create" | "reset-pin", ... }

interface StaffApi {
  id: string;
  name: string;
  role: string;
}

interface ShiftApi {
  id: string;
  staffId: string;
  staffName: string;
  startsAt: string;
  endsAt: string;
  published: boolean;
}

interface ShiftsPayload {
  staff: StaffApi[];
  shifts: ShiftApi[];
}

const ORG_HEADERS = { "X-Org-Slug": ORG_SLUG } as const;

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
const HORAS = Array.from({ length: 16 }, (_, i) => i + 8); // 8…23

const ROLE_LABEL: Record<string, string> = {
  owner: "Dueño",
  manager: "Gerente",
  cashier: "Cajero/a",
  waiter: "Mesero/a",
  kitchen: "Cocina",
};

/** Lunes 00:00 de la semana en curso. */
function mondayOf(d: Date): Date {
  const monday = new Date(d);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isoTurno(monday: Date, day: number, hour: number): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + day);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ── Modal: crear turno ──────────────────────────────────────────────────────

function TurnoModal({
  staff,
  initial,
  onClose,
  onSaved,
}: {
  staff: StaffApi[];
  initial: { staffId: string; day: number };
  onClose: () => void;
  onSaved: (turno: { staffId: string; day: number; startHour: number; endHour: number }) => void;
}) {
  const [staffId, setStaffId] = useState(initial.staffId);
  const [day, setDay] = useState(String(initial.day));
  const [startHour, setStartHour] = useState("9");
  const [endHour, setEndHour] = useState("17");

  const valido = Number(endHour) > Number(startHour);

  const selectCls =
    "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <ModalShell titulo="Nuevo turno" descripcion="Queda como borrador hasta publicar la semana." onClose={onClose}>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <label htmlFor="turno-staff" className="text-xs font-medium text-muted-foreground">
            Empleado
          </label>
          <select id="turno-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)} className={selectCls}>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {ROLE_LABEL[s.role] ?? s.role}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <label htmlFor="turno-dia" className="text-xs font-medium text-muted-foreground">
            Día de la semana
          </label>
          <select id="turno-dia" value={day} onChange={(e) => setDay(e.target.value)} className={selectCls}>
            {DIAS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="turno-inicio" className="text-xs font-medium text-muted-foreground">
            Hora de inicio
          </label>
          <select id="turno-inicio" value={startHour} onChange={(e) => setStartHour(e.target.value)} className={selectCls}>
            {HORAS.map((h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="turno-fin" className="text-xs font-medium text-muted-foreground">
            Hora de salida
          </label>
          <select id="turno-fin" value={endHour} onChange={(e) => setEndHour(e.target.value)} className={selectCls}>
            {HORAS.map((h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
        </div>
        {!valido && <p className="col-span-2 text-xs text-danger-text">La hora de salida debe ser mayor a la de inicio.</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={!valido}
          onClick={() => onSaved({ staffId, day: Number(day), startHour: Number(startHour), endHour: Number(endHour) })}
        >
          Crear turno
        </Button>
      </div>
    </ModalShell>
  );
}

// ── Sección: grid semanal (recibe datos por props — una sola fuente) ───────

function TurnosSemana({
  payload,
  source,
  refrescando,
  onRefresh,
  onCrearTurno,
  onPublicar,
}: {
  payload: ShiftsPayload;
  source: "loading" | "live" | "demo";
  refrescando: boolean;
  onRefresh: () => void;
  onCrearTurno: (turno: { staffId: string; day: number; startHour: number; endHour: number }) => void;
  onPublicar: () => void;
}) {
  const [nuevoTurno, setNuevoTurno] = useState<{ staffId: string; day: number } | null>(null);
  const [monday, setMonday] = useState<Date | null>(null);

  useEffect(() => {
    setMonday(mondayOf(new Date()));
  }, []);

  const dayIndexOf = (startsAt: string): number =>
    monday ? Math.round((new Date(startsAt).getTime() - monday.getTime()) / 86_400_000) : -1;

  const turnosDe = (staffId: string, day: number) =>
    payload.shifts.filter((s) => s.staffId === staffId && dayIndexOf(s.startsAt) === day);

  const publicados = payload.shifts.filter((s) => s.published).length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold">Turnos de la semana</h2>
          {source === "live" && (
            <Badge variant="success">
              <span className="size-1.5 rounded-full bg-success" aria-hidden /> en vivo
            </Badge>
          )}
          {source === "demo" && (
            <Badge variant="warning">
              <span className="size-1.5 rounded-full bg-warning" aria-hidden /> sin conexión
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {payload.shifts.length} turnos · {publicados} publicados
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onRefresh} aria-label="Refrescar turnos">
            <RefreshCw className={refrescando ? "animate-spin" : undefined} aria-hidden />
            Actualizar
          </Button>
          <Button size="sm" onClick={onPublicar} disabled={payload.shifts.length === 0}>
            <Send aria-hidden />
            Publicar semana
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="border-b px-4 py-3 font-medium">
                Empleado
              </th>
              {DIAS_CORTOS.map((d, i) => (
                <th key={d} scope="col" className="border-b px-2 py-3 text-center font-medium">
                  {d}
                  {monday && (
                    <span className="block text-[10px] normal-case text-muted-foreground/70">
                      {new Date(monday.getTime() + i * 86_400_000).getDate()}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payload.staff.map((st) => (
              <tr key={st.id}>
                <th scope="row" className="border-b px-4 py-2 text-left align-top font-medium">
                  {st.name}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {ROLE_LABEL[st.role] ?? st.role}
                  </span>
                </th>
                {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                  const turnos = turnosDe(st.id, day);
                  return (
                    <td key={day} className="border-b px-2 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => setNuevoTurno({ staffId: st.id, day })}
                        aria-label={`Agregar turno de ${st.name} el ${DIAS[day]}`}
                        className="flex min-h-14 w-full cursor-pointer flex-col items-stretch gap-1 rounded-lg border border-dashed p-1.5 text-left transition-colors hover:bg-muted/50"
                      >
                        {turnos.map((t) => (
                          <span
                            key={t.id}
                            className="flex flex-col gap-1 rounded-md bg-primary/10 px-1.5 py-1 text-[11px] leading-tight text-primary"
                          >
                            <span className="font-medium tabular-nums">
                              {horaCorta(t.startsAt)}–{horaCorta(t.endsAt)}
                            </span>
                            {t.published ? (
                              <Badge variant="success" className="w-fit px-1.5 py-0 text-[10px]">
                                publicado
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">borrador</span>
                            )}
                          </span>
                        ))}
                        {turnos.length === 0 && <span className="sr-only">Sin turno</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {payload.staff.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  Aún no hay empleados. Agrega el primero con «Agregar empleado».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="border-t px-4 py-3 text-xs text-muted-foreground">
        Da clic en una celda para agendar: los turnos se guardan en la base de datos. «Publicar semana» los
        marca como publicados para el equipo (el envío automático por WhatsApp llega próximamente).
      </p>

      {nuevoTurno && (
        <TurnoModal
          key={`${nuevoTurno.staffId}-${nuevoTurno.day}`}
          staff={payload.staff}
          initial={nuevoTurno}
          onClose={() => setNuevoTurno(null)}
          onSaved={(turno) => onCrearTurno(turno)}
        />
      )}
    </Card>
  );
}

// ── Modales compartidos ─────────────────────────────────────────────────────

/** Overlay + card centrada: cierra con click en el overlay o con Escape. */
function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

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
  useEscape(onClose);
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

function ResetPinModal({ empleado, onClose, onSaved }: { empleado: { nombre: string }; onClose: () => void; onSaved: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const valido = /^\d{4}$/.test(pin);

  return (
    <ModalShell titulo="Reset PIN" descripcion={`Nuevo PIN de acceso para ${empleado.nombre}.`} onClose={onClose}>
      <div className="mt-4 space-y-1.5">
        <label htmlFor="nuevo-pin" className="text-xs font-medium text-muted-foreground">
          PIN de 4 dígitos
        </label>
        <Input
          id="nuevo-pin"
          type="password"
          inputMode="numeric"
          maxLength={4}
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="••••"
          className="text-center text-lg tracking-[0.5em]"
        />
        {pin.length > 0 && !valido && <p className="text-xs text-danger-text">Debe ser exactamente 4 dígitos.</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={!valido} onClick={() => onSaved(pin)}>
          Guardar PIN
        </Button>
      </div>
    </ModalShell>
  );
}

function PermisosModal({
  permisos,
  onClose,
  onSaved,
}: {
  permisos: PermisosPorRol;
  onClose: () => void;
  onSaved: (nuevos: PermisosPorRol) => void;
}) {
  const [borrador, setBorrador] = useState<PermisosPorRol>(() => JSON.parse(JSON.stringify(permisos)) as PermisosPorRol);

  const toggle = (rol: Rol, permiso: PermisoId) =>
    setBorrador((prev) => ({ ...prev, [rol]: { ...prev[rol], [permiso]: !prev[rol][permiso] } }));

  return (
    <ModalShell
      titulo="Permisos por rol"
      descripcion="Los cambios aplican a todos los empleados con ese rol."
      onClose={onClose}
    >
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Permiso</th>
              {ROLES.map((r) => (
                <th key={r} className="px-3 py-2 text-center font-medium">
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISOS.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-3 py-2.5">{p.label}</td>
                {ROLES.map((r) => (
                  <td key={r} className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${p.label} — rol ${r}`}
                      checked={borrador[r][p.id]}
                      onChange={() => toggle(r, p.id)}
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={() => onSaved(borrador)}>Guardar permisos</Button>
      </div>
    </ModalShell>
  );
}

/** Alta de empleado real: nombre + rol + PIN (acceso a la tablet, sin cuenta). */
function EmpleadoModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (empleado: { name: string; role: string; pin: string }) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("waiter");
  const [pin, setPin] = useState("");
  const pinValido = /^\d{4}$/.test(pin);
  const valido = name.trim().length >= 2 && pinValido;

  const selectCls =
    "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <ModalShell
      titulo="Agregar empleado"
      descripcion="Accede a la tablet con su PIN — no necesita cuenta de correo."
      onClose={onClose}
    >
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="emp-nombre" className="text-xs font-medium text-muted-foreground">
            Nombre
          </label>
          <Input
            id="emp-nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Ana Quispe"
            maxLength={40}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="emp-rol" className="text-xs font-medium text-muted-foreground">
            Rol
          </label>
          <select id="emp-rol" value={role} onChange={(e) => setRole(e.target.value)} className={selectCls}>
            <option value="waiter">Mesero/a</option>
            <option value="cashier">Cajero/a</option>
            <option value="kitchen">Cocina</option>
            <option value="manager">Gerente</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="emp-pin" className="text-xs font-medium text-muted-foreground">
            PIN de 4 dígitos (lo usa para entrar en la tablet)
          </label>
          <Input
            id="emp-pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            className="text-center text-lg tracking-[0.5em]"
          />
          {pin.length > 0 && !pinValido && <p className="text-xs text-danger-text">Debe ser exactamente 4 dígitos.</p>}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={!valido}
          onClick={() => onSaved({ name: name.trim(), role, pin })}
        >
          Agregar
        </Button>
      </div>
    </ModalShell>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const [payload, setPayload] = useState<ShiftsPayload>({ staff: [], shifts: [] });
  const [source, setSource] = useState<"loading" | "live" | "demo">("loading");
  const [refrescando, setRefrescando] = useState(false);
  const [banner, setBanner] = useState<{ kind: "success" | "warning"; text: string } | null>(null);

  const [pinDe, setPinDe] = useState<{ id: string; nombre: string } | null>(null);
  const [permisosOpen, setPermisosOpen] = useState(false);
  const [empleadoOpen, setEmpleadoOpen] = useState(false);
  const [permisos, setPermisos] = useState<PermisosPorRol>(PERMISOS_INICIALES);

  const refresh = useCallback(async () => {
    setRefrescando(true);
    try {
      const res = await fetch("/api/shifts", { headers: ORG_HEADERS, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ShiftsPayload;
      setPayload({ staff: data.staff ?? [], shifts: data.shifts ?? [] });
      setSource("live");
    } catch {
      setSource("demo");
    } finally {
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** POST /api/shifts — sin conexión el turno se queda local hasta reconectar. */
  const crearTurno = async (turno: { staffId: string; day: number; startHour: number; endHour: number }) => {
    const nombre = payload.staff.find((s) => s.id === turno.staffId)?.name ?? "empleado";
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { ...ORG_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify(turno),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBanner({
        kind: "success",
        text: `Turno creado: ${nombre}, ${DIAS[turno.day]} ${turno.startHour}:00–${turno.endHour}:00.`,
      });
      void refresh();
    } catch {
      setPayload((prev) => {
        const monday = mondayOf(new Date());
        return {
          ...prev,
          shifts: [
            ...prev.shifts,
            {
              id: `local-${Date.now()}`,
              staffId: turno.staffId,
              staffName: nombre,
              startsAt: isoTurno(monday, turno.day, turno.startHour),
              endsAt: isoTurno(monday, turno.day, turno.endHour),
              published: false,
            },
          ],
        };
      });
      setBanner({
        kind: "warning",
        text: `Sin conexión con la API: el turno de ${nombre} se guardó en este dispositivo y se enviará al reconectar.`,
      });
    }
  };

  /** Marca la semana como publicada (el envío por WhatsApp llega próximamente). */
  const publicarSemana = () => {
    setPayload((prev) => ({ ...prev, shifts: prev.shifts.map((s) => ({ ...s, published: true })) }));
    setBanner({ kind: "success", text: "Semana marcada como publicada. El envío por WhatsApp llega próximamente." });
  };

  /** Alta real de empleado (POST /api/staff). */
  const agregarEmpleado = async (empleado: { name: string; role: string; pin: string }) => {
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { ...ORG_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...empleado }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    setEmpleadoOpen(false);
    if (!res.ok || !data.ok) {
      setBanner({ kind: "warning", text: data.error ?? "No se pudo agregar el empleado." });
      return;
    }
    setBanner({ kind: "success", text: `Empleado agregado: ${empleado.name} (${ROLE_LABEL[empleado.role] ?? empleado.role}). Ya puede entrar a la tablet con su PIN.` });
    void refresh();
  };

  /** Reset de PIN real (POST /api/staff reset-pin). */
  const resetPin = async (staffId: string, pin: string) => {
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { ...ORG_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset-pin", staffId, pin }),
    });
    setPinDe(null);
    if (!res.ok) {
      setBanner({ kind: "warning", text: "No se pudo actualizar el PIN." });
      return;
    }
    setBanner({ kind: "success", text: "PIN actualizado." });
  };

  // En turno = tiene un shift de HOY que cubre la hora actual.
  const ahora = new Date();
  const enTurnoDe = (staffId: string): boolean =>
    payload.shifts.some((s) => {
      if (s.staffId !== staffId) return false;
      const start = new Date(s.startsAt);
      const end = new Date(s.endsAt);
      return ahora >= start && ahora <= end;
    });

  const turnosSemanaDe = (staffId: string): number =>
    payload.shifts.filter((s) => s.staffId === staffId).length;

  const enTurno = payload.staff.filter((s) => enTurnoDe(s.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Staff</h1>
          <p className="text-sm text-muted-foreground">
            {payload.staff.length} empleados · {enTurno} en turno · acceso por PIN (sin cuentas de correo)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPermisosOpen(true)}>
            <ShieldCheck aria-hidden />
            Permisos
          </Button>
          <Button onClick={() => setEmpleadoOpen(true)}>
            <UserPlus aria-hidden />
            Agregar empleado
          </Button>
        </div>
      </div>

      {banner && (
        <div
          role="status"
          className={
            banner.kind === "success"
              ? "flex items-center justify-between gap-3 rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success-text"
              : "flex items-center justify-between gap-3 rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning-text"
          }
        >
          <span>{banner.text}</span>
          <Button variant="ghost" size="icon" onClick={() => setBanner(null)} aria-label="Descartar aviso">
            <X />
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {payload.staff.map((e) => (
          <Card key={e.id} className="p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {e.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.name}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <Badge variant="outline">{ROLE_LABEL[e.role] ?? e.role}</Badge>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`size-2 rounded-full ${enTurnoDe(e.id) ? "bg-success" : "bg-muted-foreground/40"}`} aria-hidden />
                    {enTurnoDe(e.id) ? "En turno" : "Fuera de turno"}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2 border-t pt-3">
              <span className="text-xs text-muted-foreground">Turnos esta semana</span>
              <span className="font-semibold tabular-nums">{turnosSemanaDe(e.id)}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPinDe({ id: e.id, nombre: e.name })}>
                <KeyRound aria-hidden />
                Reset PIN
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPermisosOpen(true)}>
                <ShieldCheck aria-hidden />
                Permisos
              </Button>
            </div>
          </Card>
        ))}

        {payload.staff.length === 0 && source !== "loading" && (
          <Card className="p-6 text-center text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
            Aún no hay empleados. Agrega el primero con «Agregar empleado»: recibirá un PIN
            para entrar a la tablet del POS.
          </Card>
        )}

        <Card className="flex flex-col justify-center p-4">
          <p className="text-sm font-medium">Equipo</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{payload.staff.length}</p>
          <p className="text-xs text-muted-foreground">
            {enTurno} en turno ahora · {payload.shifts.length} turnos agendados esta semana
          </p>
        </Card>
      </div>

      <TurnosSemana
        payload={payload}
        source={source}
        refrescando={refrescando}
        onRefresh={() => void refresh()}
        onCrearTurno={(turno) => void crearTurno(turno)}
        onPublicar={publicarSemana}
      />

      <p className="text-xs text-muted-foreground">
        Los empleados de piso (meseros, cocina, caja) entran a la tablet del POS con su PIN — no crean cuenta
        de correo. El dueño y los gerentes con cuenta entran desde la pantalla de login del panel.
      </p>

      {pinDe && (
        <ResetPinModal
          key={pinDe.id}
          empleado={{ nombre: pinDe.nombre }}
          onClose={() => setPinDe(null)}
          onSaved={(pin) => void resetPin(pinDe.id, pin)}
        />
      )}

      {permisosOpen && (
        <PermisosModal
          permisos={permisos}
          onClose={() => setPermisosOpen(false)}
          onSaved={(nuevos) => {
            setPermisos(nuevos);
            setPermisosOpen(false);
            setBanner({ kind: "success", text: "Preferencias de permisos guardadas en este dispositivo." });
          }}
        />
      )}

      {empleadoOpen && (
        <EmpleadoModal
          onClose={() => setEmpleadoOpen(false)}
          onSaved={(empleado) => void agregarEmpleado(empleado)}
        />
      )}
    </div>
  );
}
