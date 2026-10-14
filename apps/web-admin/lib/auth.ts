import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Sesión firmada (HMAC-SHA256) en cookie HttpOnly — auth real sin proveedor
 * externo. En F0.2 puede migrar a Clerk/Auth.js: el contrato de sesión
 * (uid/email/name) no cambia.
 */
const SECRET = process.env.AUTH_SECRET ?? "dev-secret-rest-fase0";
export const SESSION_COOKIE = "rest_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface SessionPayload {
  uid: string;
  email: string;
  name: string;
  exp: number;
  /** OIDC-style actor claim: presente SOLO en sesiones de impersonación,
   *  con el email del superadmin que entró como este usuario. */
  act?: { email: string };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const full: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const body = base64url(JSON.stringify(full));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
  // En deploy con HTTPS (Caddy/túnel) el compose pasa COOKIE_SECURE=true.
  secure: process.env.COOKIE_SECURE === "true",
};
