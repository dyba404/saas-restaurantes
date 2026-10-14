import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPlatformRole } from "@/lib/superadmin";
import { Sidebar } from "@/components/sidebar";
import { Statusbar, Topbar } from "@/components/topbar";
import { StopImpersonation } from "@/app/superadmin/components";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // El superadmin NO tiene restaurante propio: su superficie es /superadmin.
  // Excepción: mientras impersona a un dueño sí opera este panel (con banner).
  const platformRole = await getPlatformRole(session.uid);
  if (platformRole === "superadmin" && !session.act) {
    redirect("/superadmin");
  }

  const initials = session.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {session.act && (
          <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-600">
            <span>
              👤 Impersonación auditada — entraste como <strong>{session.email}</strong>
            </span>
            <StopImpersonation />
          </div>
        )}
        <Topbar userName={session.name} userInitials={initials} />
        <Statusbar />
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
