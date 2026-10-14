/**
 * Punto de entrada del API (web-admin). CORS resuelto en el server;
 * todas las llamadas llevan el header de tenant.
 */
/**
 * Punto de entrada del API (web-admin). CORS resuelto en el server;
 * todas las llamadas llevan el header de tenant.
 * NEXT_PUBLIC_* se inlinean en build: en dev caen a localhost.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
export const ORG_SLUG = process.env.NEXT_PUBLIC_ORG_SLUG ?? "cevicheria-el-muelle";

export const ORG_HEADERS: Record<string, string> = { "X-Org-Slug": ORG_SLUG };

/** Header de dispositivo cuando la carta ya fue activada con su token. */
export function deviceHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("rest.device.token");
    return token ? { "X-Device-Token": token } : {};
  } catch {
    return {};
  }
}

function ensureDeviceToken(): string | null {
  try {
    let token = localStorage.getItem("rest.device.token");
    if (!token) {
      token = window.prompt("Activa esta carta: pega el token que te dio el administrador") ?? "";
      if (!token) return null;
      localStorage.setItem("rest.device.token", token.trim());
      window.location.reload(); // el motor de sync nació sin token: remonta limpio
    }
    return token.trim();
  } catch {
    return null;
  }
}

/** fetch con timeout duro (ms) vía AbortController — la carta debe fallar rápido. */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 2_500, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, {
      ...rest,
      headers: { ...(rest.headers ?? {}), ...deviceHeaders() },
      signal: controller.signal,
    });
    if (response.status === 403) {
      const body = (await response.clone().json().catch(() => null)) as { code?: string } | null;
      if (body?.code === "device_required") {
        clearTimeout(timer);
        const token = ensureDeviceToken();
        if (token) {
          return fetchWithTimeout(input, {
            ...rest,
            headers: { ...(rest.headers ?? {}), "X-Device-Token": token },
            timeoutMs,
          });
        }
      }
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}
