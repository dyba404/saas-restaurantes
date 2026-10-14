import { and, eq, isNull } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { devices, organizations, type Organization } from "@rest/db";
import type { LocalDb } from "@/lib/db";

/**
 * Auth de dispositivos para las PWA (POS/KDS/carta).
 *
 * Cada tablet presenta el header `X-Device-Token` con el token que el
 * superadmin le provisionó (se muestra UNA vez al crear el dispositivo).
 * Con DEVICE_AUTH=true el API resuelve el tenant DESDE el token — el
 * X-Org-Slug deja de ser suficiente. Con DEVICE_AUTH=false (dev) el
 * comportamiento es el de siempre, para no romper el flujo local.
 */

export interface ResolvedDevice {
  org: Organization;
  deviceId: string;
  deviceName: string;
}

export function deviceAuthEnabled(): boolean {
  return process.env.DEVICE_AUTH === "true";
}

export function newDeviceToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * Hash DETERMINISTA del token: la búsqueda es por igualdad (el token en claro
 * nunca se guarda) y el pepper (AUTH_SECRET) impide romperlo desde la DB.
 * NO usar scrypt aquí: su salt aleatorio haría cada hash distinto.
 */
export function deviceTokenHash(token: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "rest-device-pepper")
    .update(token)
    .digest("hex");
}

export const DEVICE_REQUIRED_ERROR = {
  error: "Dispositivo no autorizado. Activa esta tablet con su token (superadmin).",
  code: "device_required",
};

/** Resuelve (org, device) desde el header X-Device-Token. Null si inválido. */
export async function resolveDevice(
  req: Request,
  db: LocalDb,
): Promise<ResolvedDevice | null> {
  const token = req.headers.get("x-device-token");
  return token ? resolveDeviceByToken(db, token) : null;
}

/** Variante por query param para SSE (EventSource no puede mandar headers). */
export async function resolveDeviceByToken(
  db: LocalDb,
  token: string,
): Promise<ResolvedDevice | null> {
  if (!token) return null;
  const [row] = await db
    .select({
      deviceId: devices.id,
      deviceName: devices.name,
      org: organizations,
    })
    .from(devices)
    .innerJoin(organizations, eq(organizations.id, devices.organizationId))
    .where(and(eq(devices.tokenHash, deviceTokenHash(token)), isNull(devices.revokedAt)))
    .limit(1);
  if (!row) return null;
  // last_seen fire-and-forget (telemetría ligera de dispositivos activos)
  void db
    .update(devices)
    .set({ lastSeenAt: new Date() })
    .where(eq(devices.id, row.deviceId))
    .catch(() => undefined);
  return { org: row.org, deviceId: row.deviceId, deviceName: row.deviceName };
}
