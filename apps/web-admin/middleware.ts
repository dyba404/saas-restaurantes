import { NextRequest, NextResponse } from "next/server";

/**
 * Guard de sesión (chequeo barato de presencia de cookie en el edge).
 * La verificación criptográfica completa ocurre en el servidor (layout + rutas).
 */
const PUBLIC_PATHS = ["/login", "/signup", "/landing", "/terminos", "/privacidad"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("rest_session")?.value);

  if (!hasSession && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && ["/login", "/signup"].some((p) => pathname.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon.svg|icon-maskable.svg).*)"],
};
