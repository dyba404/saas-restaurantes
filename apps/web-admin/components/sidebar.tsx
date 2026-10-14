"use client";

import {
  Armchair,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  CircleHelp,
  LayoutDashboard,
  MessageCircle,
  Package,
  Receipt,
  Settings,
  Store,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@rest/ui";

/** Navegación agrupada por momento de uso: vender, captar canales y operar. */
const NAV_SECTIONS = [
  {
    label: "Ventas",
    items: [
      { href: "/", label: "Resumen", icon: LayoutDashboard },
      { href: "/ordenes", label: "Órdenes", icon: Receipt },
      { href: "/caja", label: "Caja", icon: Wallet },
      { href: "/mesas", label: "Mesas", icon: Armchair },
      { href: "/reservas", label: "Reservas", icon: CalendarDays },
    ],
  },
  {
    label: "Canales",
    items: [
      { href: "/menu", label: "Menú", icon: UtensilsCrossed },
      { href: "/canales", label: "Canales", icon: Store },
      { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
      { href: "/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    label: "Operación",
    items: [
      { href: "/inventario", label: "Inventario", icon: Package },
      { href: "/staff", label: "Staff", icon: Users },
      { href: "/reportes", label: "Reportes", icon: BarChart3 },
      { href: "/config", label: "Configuración", icon: Settings },
      { href: "/ayuda", label: "Ayuda", icon: CircleHelp },
    ],
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-dvh shrink-0 flex-col border-r bg-card transition-[width]",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
          R
        </span>
        {!collapsed && <span className="font-semibold tracking-tight">rest</span>}
      </div>

      <nav className="flex-1 overflow-y-auto p-2" aria-label="Navegación principal">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.label} className={cn(i > 0 && "mt-4 border-t pt-4")}>
            {!collapsed && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {section.label}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-muted font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "")} />
                    {!collapsed && label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        {!collapsed && (
          <div className="mb-3 flex items-center justify-between rounded-md bg-muted px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Plan</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              PRO
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && "Colapsar"}
        </button>
      </div>
    </aside>
  );
}
