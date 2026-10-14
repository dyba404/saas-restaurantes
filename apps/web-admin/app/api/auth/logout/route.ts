import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/** Limpia la cookie de sesión (compartido por GET y POST). */
function clearSession() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}

/** GET permite deep-link /api/auth/logout — útil para kioscos y tablets. */
export async function GET() {
  return clearSession();
}

export async function POST() {
  return clearSession();
}
