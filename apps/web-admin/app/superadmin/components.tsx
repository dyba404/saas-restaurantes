"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@rest/ui";

/** Sale de la impersonación y restaura la sesión del superadmin. */
export function StopImpersonation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/superadmin/stop-impersonate", { method: "POST" });
        router.push("/superadmin/restaurantes");
        router.refresh();
      }}
    >
      Volver a mi sesión
    </Button>
  );
}

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
}

/** Suspender / Reactivar + cambio de plan, con auditoría en el server. */
export function TenantActions({ org }: { org: OrgRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function send(body: Record<string, string>, tag: string) {
    setBusy(tag);
    await fetch(`/api/superadmin/orgs/${org.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    router.refresh();
  }

  const suspended = org.status === "suspended";
  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Plan"
        value={org.plan}
        disabled={busy !== null}
        onChange={(e) => void send({ plan: e.target.value }, "plan")}
        className="h-8 rounded-md border border-border bg-card px-2 text-xs"
      >
        <option value="free">free</option>
        <option value="pro">pro</option>
        <option value="multi">multi</option>
      </select>
      <Button
        size="sm"
        variant={suspended ? "default" : "outline"}
        disabled={busy !== null}
        onClick={() => void send({ status: suspended ? "active" : "suspended" }, "status")}
      >
        {busy === "status" ? "…" : suspended ? "Reactivar" : "Suspender"}
      </Button>
    </div>
  );
}

interface DeviceRow {
  id: string;
  name: string;
  kind: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
}

/** Gestión de dispositivos del tenant: crear (token una vez) y revocar. */
export function TenantDevices({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<DeviceRow[] | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("pos");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  function load(): void {
    void fetch(`/api/superadmin/orgs/${orgId}/devices`)
      .then((r) => r.json())
      .then((data: { devices?: DeviceRow[] }) => setRows(data.devices ?? []));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function create(): Promise<void> {
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/superadmin/orgs/${orgId}/devices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name: name.trim(), kind }),
    });
    const data = (await res.json()) as { token?: string };
    setBusy(false);
    setName("");
    setToken(data.token ?? null);
    load();
    router.refresh();
  }

  async function revoke(deviceId: string): Promise<void> {
    if (!confirm("¿Revocar este dispositivo? Dejará de operar al instante.")) return;
    setBusy(true);
    await fetch(`/api/superadmin/orgs/${orgId}/devices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", deviceId }),
    });
    setBusy(false);
    load();
    router.refresh();
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-neutral-300">Dispositivos (tablets)</h2>
      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs text-neutral-400">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Última conexión</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((d) => (
              <tr key={d.id} className="border-t border-neutral-800">
                <td className="px-3 py-2">{d.name}</td>
                <td className="px-3 py-2 text-neutral-400">{d.kind}</td>
                <td className="px-3 py-2 text-neutral-400">
                  {d.revokedAt ? (
                    <span className="text-red-400">revocado</span>
                  ) : d.lastSeenAt ? (
                    String(d.lastSeenAt).replace("T", " ").slice(0, 16)
                  ) : (
                    "nunca"
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {!d.revokedAt && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void revoke(d.id)}>
                      Revocar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-neutral-500" colSpan={4}>
                  Sin dispositivos — crea uno y pega su token en la tablet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Tablet POS Salón"
          className="h-9 rounded-md border border-neutral-700 bg-neutral-900 px-2 text-sm"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="h-9 rounded-md border border-neutral-700 bg-neutral-900 px-2 text-sm"
        >
          <option value="pos">pos</option>
          <option value="kds">kds</option>
          <option value="menu">menu</option>
        </select>
        <Button size="sm" disabled={busy || !name.trim()} onClick={() => void create()}>
          Crear dispositivo
        </Button>
      </div>
      {token && (
        <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 font-mono text-xs text-amber-300">
          Token (mostrado UNA vez — pégalo en la tablet): {token}
        </p>
      )}
    </section>
  );
}

interface UserRow {
  userId: string;
  email: string;
  name: string;
  role: string;
  platformRole: string | null;
}

/** Acciones sobre usuarios de un tenant: reset de password, quitar acceso, impersonar. */
export function UserActions({ orgId, user }: { orgId: string; user: UserRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const isSuper = user.platformRole === "superadmin";

  async function post(body: Record<string, unknown>, after?: (data: { tempPassword?: string }) => void) {
    setBusy(true);
    const res = await fetch(`/api/superadmin/orgs/${orgId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { tempPassword?: string; error?: string };
    setBusy(false);
    after?.(data);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={busy || isSuper}
        title={isSuper ? "No se modifica a otro superadmin" : undefined}
        onClick={() =>
          void post({ action: "reset-password", userId: user.userId }, (data) =>
            setTemp(data.tempPassword ?? null),
          )
        }
      >
        Reset password
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || isSuper}
        onClick={() => {
          if (confirm(`¿Quitar el acceso de ${user.email} a este restaurante?`)) {
            void post({ action: "remove", userId: user.userId });
          }
        }}
      >
        Quitar acceso
      </Button>
      <Button
        size="sm"
        disabled={busy || isSuper}
        title={isSuper ? "No se impersona a otro superadmin" : "Entrar como (auditado)"}
        onClick={async () => {
          setBusy(true);
          await fetch("/api/superadmin/impersonate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.userId }),
          });
          setBusy(false);
          router.push("/");
        }}
      >
        Entrar como
      </Button>
      {temp && (
        <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 font-mono text-xs text-amber-300">
          temporal: {temp} (no se vuelve a mostrar)
        </span>
      )}
    </div>
  );
}
