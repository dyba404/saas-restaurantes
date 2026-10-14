import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Layout público de marketing — mínimo: logo de la marca + acceso a /login.
 * El contenido (landing) vive en app/(marketing)/landing/page.tsx.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/landing" className="flex items-center gap-2" aria-label="rest — inicio">
            <span
              className="flex size-7 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground"
              aria-hidden
            >
              R
            </span>
            <span className="text-base font-semibold tracking-tight">rest</span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
