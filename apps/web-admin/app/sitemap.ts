import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Sitemap con solo rutas públicas reales.
 * - /landing: landing pública (middleware PUBLIC_PATHS).
 * - /reservas NO se incluye: solo existe bajo (dash) y requiere sesión.
 * - /login y /signup son públicas pero sin valor de indexación (omitidas).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL("/landing", baseUrl).href,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
