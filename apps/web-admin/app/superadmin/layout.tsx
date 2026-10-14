import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { requireSuperadmin } from "@/lib/superadmin";
import { StopImpersonation } from "./components";

export const metadata = { title: "Superadmin" };

/**
 * Panel de plataforma (dueño del SaaS). Guard duro: sesión + rol en DB.
 * Superficie separada del panel del dueño de cada restaurante.
 */
export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireSuperadmin();
  if (!admin) redirect("/login?next=/superadmin");

  const session = await getSession();
  const impersonating = session?.act;

  return (
    <div className="min-h-dvh dark bg-background text-foreground">
      <header className="border-b border-border px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="size-4 text-emerald-400" /> Rest · Plataforma
          </span>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/superadmin" className="rounded-lg px-3 py-1.5 hover:bg-accent">
              Resumen
            </Link>
            <Link
              href="/superadmin/restaurantes"
              className="rounded-lg px-3 py-1.5 hover:bg-accent"
            >
              Restaurantes
            </Link>
            <Link
              href="/superadmin/auditoria"
              className="rounded-lg px-3 py-1.5 hover:bg-accent"
            >
              Auditoría
            </Link>
            <Link
              href="/superadmin/ayuda"
              className="rounded-lg px-3 py-1.5 hover:bg-accent"
            >
              Ayuda
            </Link>
          </nav>
          <span className="ml-auto text-xs text-muted-foreground">{admin.email}</span>
          <Link href="/landing" className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent">
            Landing
          </Link>
        </div>
      </header>

      {impersonating && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <span>
              👤 Entrando como <strong>{session.email}</strong> (impersonación auditada)
            </span>
            <StopImpersonation />
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  );
}
