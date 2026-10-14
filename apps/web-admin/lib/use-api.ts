/**
 * Cliente HTTP del panel — offline-first.
 * La UI nunca se rompe: si la API no responde (offline, timeout, error HTTP o
 * JSON inválido) se devuelve el `fallback` tipado que provee la página.
 */

export const API_BASE = "http://localhost:3000";

/** Organización activa — vendrá de la sesión (F0.2); por ahora es fija. */
export const ORG_SLUG = "cevicheria-el-muelle";

const TIMEOUT_MS = 2_500;

export async function fetchApi<T>(path: string, fallback: T): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "X-Org-Slug": ORG_SLUG },
      signal: controller.signal,
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
