"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, CardContent, Input } from "@rest/ui";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ restaurantName: "", name: "", email: "", password: "" });
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear la cuenta");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Error de red — intenta de nuevo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="p-8">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
            R
          </span>
          <h1 className="text-lg font-semibold tracking-tight">Crea tu cuenta gratis</h1>
          <p className="text-sm text-muted-foreground">
            Sin contratos · cancela cuando quieras · exportas tus datos
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="restaurantName" className="text-sm font-medium">
              Nombre del restaurante
            </label>
            <Input
              id="restaurantName"
              required
              value={form.restaurantName}
              onChange={(e) => set("restaurantName", e.target.value)}
              placeholder="Cevichería El Muelle"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Tu nombre
            </label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="María Rodríguez"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="tu@restaurante.pe"
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Contraseña (mín. 8 caracteres)
            </label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="flex items-start gap-2.5">
            <input
              id="accept-terms"
              type="checkbox"
              required
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
            />
            <label htmlFor="accept-terms" className="text-xs leading-relaxed text-muted-foreground">
              Acepto los{" "}
              <Link href="/terminos" target="_blank" className="underline">
                Términos del servicio
              </Link>{" "}
              y la{" "}
              <Link href="/privacidad" target="_blank" className="underline">
                Política de privacidad
              </Link>
              .
            </label>
          </div>

          {error && (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-danger-text">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Crear mi restaurante
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
