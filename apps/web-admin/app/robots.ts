import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Robots: se permite rastrear "/" en general (incluye la landing pública /landing
 * y las páginas públicas /login y /signup) y se bloquean los endpoints de API y
 * las secciones privadas del panel ((dash)), que igualmente requieren sesión.
 * La raíz "/" en sí no se bloquea porque el prefijo afectaría también a /landing.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/caja/",
          "/canales/",
          "/clientes/",
          "/config/",
          "/inventario/",
          "/menu/",
          "/mesas/",
          "/onboarding/",
          "/ordenes/",
          "/reportes/",
          "/reservas/",
          "/staff/",
          "/whatsapp/",
        ],
      },
    ],
    sitemap: new URL("/sitemap.xml", baseUrl).href,
  };
}
