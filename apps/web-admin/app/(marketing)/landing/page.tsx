"use client";

import Link from "next/link";
import {
  Check,
  ChefHat,
  DatabaseBackup,
  Laptop,
  MessageCircle,
  QrCode,
  Unlock,
  WifiOff,
} from "lucide-react";
import { buttonVariants, Card, CardContent } from "@rest/ui";

/**
 * Landing de marketing (F2) — página pública en /landing.
 * Server component: no hay interactividad, solo enlaces a /signup y /login.
 */

const features = [
  {
    icon: WifiOff,
    title: "POS offline-first",
    description:
      "Toma órdenes aunque se caiga el internet. Todo sincroniza solo cuando vuelve la conexión — la comida no se detiene.",
  },
  {
    icon: ChefHat,
    title: "KDS incluido, sin cobro por pantalla",
    description:
      "La comanda en cocina en cualquier tablet que ya tengas. Una pantalla o diez: el plan cuesta lo mismo.",
  },
  {
    icon: QrCode,
    title: "Menú QR en menos de 3 segundos",
    description:
      "El comensal escanea y ya está viendo tu carta, siempre actualizada. Sin apps, sin descargas, sin fricción.",
  },
  {
    icon: MessageCircle,
    title: "Pedidos por WhatsApp sin comisiones",
    description:
      "Recibe pedidos a domicilio y para recoger directo por WhatsApp. Cero comisiones de intermediarios.",
  },
] as const;

const plans = [
  {
    name: "Gratis",
    price: "S/ 0",
    period: "para siempre",
    description: "Para probar el sistema en tu local desde el día uno.",
    features: ["100 órdenes/mes", "1 local", "POS + KDS + menú QR"],
    cta: "Empieza gratis",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "S/ 129/mes",
    period: "por local",
    description: "Para restaurantes en operación que quieren crecer.",
    features: ["Sin límite de órdenes", "Pedidos por WhatsApp", "Reportes completos", "Programa de loyalty"],
    cta: "Probar Pro gratis",
    highlighted: true,
  },
  {
    name: "Multi-ubicación",
    price: "S/ 299/mes",
    period: "hasta 10 locales",
    description: "Para cadenas y grupos con varias sucursales.",
    features: ["Hasta 10 locales", "Consola de cadena", "Menú centralizado"],
    cta: "Escalar mi negocio",
    highlighted: false,
  },
] as const;

const noFinePrint = [
  {
    icon: Unlock,
    title: "Sin multas de salida",
    description: "Si no te convence, te vas. Sin penalizaciones ni letra chica.",
  },
  {
    icon: Laptop,
    title: "Sin hardware propietario",
    description: "Funciona en la tablet o iPad que ya tienes en la caja.",
  },
  {
    icon: QrCode,
    title: "Sin cobro por dispositivo",
    description: "Agrega las tablets y pantallas que necesites: no cobramos por terminal.",
  },
  {
    icon: DatabaseBackup,
    title: "Tus datos exportables siempre",
    description: "Tu menú, tus órdenes y tus clientes son tuyos. Descárgalos cuando quieras.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-14 text-center md:px-6 md:pt-20" aria-labelledby="hero-title">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          POS · Cocina · Menú QR · WhatsApp
        </span>
        <h1 id="hero-title" className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
          El sistema operativo de tu restaurante
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
          POS, cocina, menú QR y pedidos por WhatsApp en cualquier tablet barata. Sin contratos, sin
          hardware propietario, con tus datos siempre tuyos.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            Crea tu cuenta gratis
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Ver demo
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Listo en minutos · no necesitas tarjeta
        </p>
      </section>

      {/* Features */}
      <section className="border-y bg-muted/40 py-16" aria-labelledby="features-title">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <h2 id="features-title" className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
            Todo lo que tu local necesita, incluido
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground md:text-base">
            Un solo sistema para la caja, la cocina y el comensal. Sin cobros sorpresa por módulo.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="p-5">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16" aria-labelledby="pricing-title">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <h2 id="pricing-title" className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
            Precios claros, en soles
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground md:text-base">
            Empieza gratis y sube de plan cuando tu local lo pida.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.highlighted ? "relative border-primary/40 ring-2 ring-primary/30" : undefined
                }
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{plan.name}</h3>
                    {plan.highlighted && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        <span className="size-2 rounded-full bg-primary" aria-hidden />
                        Más popular
                      </span>
                    )}
                  </div>
                  <p className="mt-3">
                    <span className="text-3xl font-bold tracking-tight">{plan.price}</span>{" "}
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{plan.description}</p>
                  <ul className="mt-5 space-y-2.5">
                    {plan.features.map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-sm">
                        <Check className="size-4 shrink-0 text-success-text" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className={buttonVariants({
                      variant: plan.highlighted ? "default" : "outline",
                      className: "mt-6 w-full",
                    })}
                  >
                    {plan.cta}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Sin contratos. Cancela cuando quieras. Exporta todos tus datos en un clic.
          </p>
        </div>
      </section>

      {/* Sin letras chicas */}
      <section className="border-t bg-muted/40 py-16" aria-labelledby="nofineprint-title">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <h2 id="nofineprint-title" className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
            Sin letras chicas
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground md:text-base">
            Tu restaurante no es rehén de su proveedor de software. Nunca.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {noFinePrint.map((item) => (
              <div
                key={item.title}
                className="flex gap-3 rounded-xl border bg-card p-5 text-card-foreground shadow-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success-text">
                  <item.icon className="size-4.5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16" aria-labelledby="final-cta-title">
        <div className="mx-auto w-full max-w-6xl px-4 text-center md:px-6">
          <h2 id="final-cta-title" className="text-2xl font-semibold tracking-tight md:text-3xl">
            ¿Listo para subir la mira de tu negocio?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            Crea tu cuenta, carga tu menú con plantillas y está imprimiendo tus QRs en menos de 15 minutos.
          </p>
          <div className="mt-6">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Crea tu cuenta gratis
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm text-muted-foreground sm:flex-row md:px-6">
          <p>© 2026 rest — el sistema operativo de tu restaurante</p>
          <div className='flex items-center gap-4'>
            <Link href='/terminos' className='hover:text-foreground'>Términos</Link>
            <Link href='/privacidad' className='hover:text-foreground'>Privacidad</Link>
            <span className='hidden sm:inline'>Hecho para LatAm 🇵🇪</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
