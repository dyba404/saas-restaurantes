"use client";

import { Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Card, CardContent, Input } from "@rest/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo iniciar sesión");
        return;
      }
      router.push(params.get("next") ?? "/");
      router.refresh();
    } catch {
      setError("Error de red — intenta de nuevo");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setEmail("maria@cevicheriaelmuelle.pe");
    setPassword("demo1234");
  }

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="p-8">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
            R
          </span>
          <h1 className="text-lg font-semibold tracking-tight">Entra a tu restaurante</h1>
          <p className="text-sm text-muted-foreground">POS, cocina y pedidos en un solo panel</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@restaurante.pe"
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-danger-text">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            Iniciar sesión
          </Button>
        </form>

        <button
          type="button"
          onClick={fillDemo}
          className="mt-4 w-full rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
        >
          Demo: maria@cevicheriaelmuelle.pe · demo1234 (clic para llenar)
        </button>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          ¿Nuevo restaurante?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Crea tu cuenta gratis
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
