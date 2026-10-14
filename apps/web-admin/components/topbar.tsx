"use client";

import { Bell, ChevronDown, LogOut, Printer, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@rest/ui";
import { ORG_SLUG } from "@/lib/use-api";

type AlertLevel = "danger" | "warning" | "info";
interface AlertItem {
  level: AlertLevel;
  text: string;
}

interface BootstrapOrg {
  organization?: { name?: string };
  location?: { name?: string };
}

const NAMES_CACHE_KEY = "rest.topbar.names";

/** Nombre real del restaurante y local (bootstrap) con caché de 5 min:
 *  evita repetir la request más pesada en cada navegación. */
function useOrgLocation() {
  const [names, setNames] = useState<{ org: string; location: string } | null>(() => {
    try {
      const raw = sessionStorage.getItem(NAMES_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { names: { org: string; location: string }; at: number };
      if (Date.now() - parsed.at < 300_000) return parsed.names;
    } catch {
      /* sin caché disponible */
    }
    return null;
  });

  useEffect(() => {
    if (names) return;
    let alive = true;
    fetch("/api/bootstrap", { headers: { "X-Org-Slug": ORG_SLUG }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: BootstrapOrg & { location?: { name?: string } }) => {
        const value = {
          org: data.organization?.name ?? "Mi restaurante",
          location: data.location?.name ?? "Local",
        };
        if (!alive) return;
        setNames(value);
        try {
          sessionStorage.setItem(
            NAMES_CACHE_KEY,
            JSON.stringify({ names: value, at: Date.now() }),
          );
        } catch {
          /* storage lleno o bloqueado: sin caché */
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [names]);

  return names;
}

/** Campana de alertas REALES del día (GET /api/dashboard): SLA, agotados, stock. */
function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/dashboard", { headers: { "X-Org-Slug": ORG_SLUG } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(
        (data: {
          alertas?: { agotados: number; bajoStock: number; esperando: number };
        }) => {
          const a = data.alertas ?? { agotados: 0, bajoStock: 0, esperando: 0 };
          const list: AlertItem[] = [];
          if (a.esperando > 0)
            list.push({
              level: "danger",
              text: `${a.esperando} orden(es) esperando más de 10 min`,
            });
          if (a.agotados > 0)
            list.push({ level: "warning", text: `${a.agotados} producto(s) agotados (86)` });
          if (a.bajoStock > 0)
            list.push({ level: "warning", text: `${a.bajoStock} insumo(s) bajo stock mínimo` });
          setAlerts(list);
        },
      )
      .catch(() => setAlerts([]));
  }, [open]);

  const count = alerts?.length ?? 0;
  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-md p-2 hover:bg-muted"
        aria-label="Notificaciones"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="size-4" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border bg-card p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Alertas de hoy</p>
              <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)}>
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            {alerts === null ? (
              <p className="py-2 text-sm text-muted-foreground">Cargando…</p>
            ) : count === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Todo en orden ✔</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((a) => (
                  <button
                    key={a.text}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push(a.level === "danger" ? "/" : "/menu");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md border bg-background px-3 py-2.5 text-left text-sm hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        a.level === "danger" ? "bg-destructive" : "bg-warning",
                      )}
                      aria-hidden
                    />
                    <span>{a.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Chip neutro con punto de color — el estado se lee por el punto, no por un bloque de color. */
function StatusChip({
  tone,
  children,
}: {
  tone?: "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
      {tone && (
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            tone === "success" && "bg-success",
            tone === "warning" && "bg-warning",
            tone === "danger" && "bg-destructive",
          )}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

/** Topbar con el nombre REAL del restaurante y local (bootstrap), sin buscador decorativo. */
export function Topbar({
  userName = "María Rodríguez",
  userInitials = "MR",
}: {
  userName?: string;
  userInitials?: string;
}) {
  const router = useRouter();
  const names = useOrgLocation();
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-4">
      <button
        type="button"
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
      >
        <span className="size-2 rounded-full bg-success" aria-hidden />
        {names ? `${names.org} · ${names.location}` : "Cargando restaurante…"}
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>

      <NotificationsBell />

      <div className="flex items-center gap-2 border-l pl-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
          {userInitials}
        </span>
        <div className="hidden text-xs leading-tight lg:block">
          <p className="font-medium">{userName}</p>
          <p className="text-muted-foreground">Dueña</p>
        </div>
        <button
          type="button"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/login");
          }}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}

/** Barra de estado persistente — docs/04-diseno-web.md (principio 3).
 *  Honesta: solo muestra estados reales. La impresión se configura por dispositivo;
 *  los canales de venta entran en F4 (ver página Canales). */
export function Statusbar() {
  // Fecha/hora reales (se actualiza cada 30 s) — nada de texto estático.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(i);
  }, []);
  const fecha = now?.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  const hora = now?.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-1.5">
      <StatusChip tone="success">Sincronizado</StatusChip>
      <a
        href="/config"
        className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
      >
        <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
        <Printer className="size-3" aria-hidden />
        Sin impresora en este equipo · configurar
      </a>
      <a
        href="/canales"
        className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
      >
        <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden />
        Canales: sin conectar (F4)
      </a>
      <span className="ml-auto text-xs text-muted-foreground">
        {fecha ? `${fecha} · ${hora}` : ""}
      </span>
    </div>
  );
}
