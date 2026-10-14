import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { organizations, type Organization } from "@rest/db";
import { getDb, type LocalDb } from "@/lib/db";
import { DEVICE_REQUIRED_ERROR, deviceAuthEnabled, resolveDevice } from "@/lib/devices";
import { suspendedMessage } from "@/lib/support";

/**
 * Wrapper de route handlers: CORS para las PWA (POS :3001, KDS :3002, Carta :3003),
 * resolución de tenant por X-Org-Slug y errores en JSON.
 *
 * Orígenes permitidos por env (ALLOWED_ORIGINS, separados por coma) con fallback
 * a los puertos de desarrollo. En deploy el Caddy/compose pasa los dominios reales.
 */
const DEFAULT_ORIGINS = [
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
];
const ALLOWED_ORIGINS = new Set([
  ...(process.env.ALLOWED_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean) ?? []),
  ...DEFAULT_ORIGINS,
]);

// Exportada para GET /api/realtime (SSE), que no pasa por withOrgApi.
export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Org-Slug, X-Device-Token",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

function json(body: unknown, status: number, cors: Record<string, string>): NextResponse {
  return NextResponse.json(body, { status, headers: cors });
}

/**
 * Preflight CORS. Next.js responde OPTIONS automáticamente SOLO si la ruta no
 * lo exporta — y ese 204 automático no trae headers CORS, lo que mata los
 * fetch cross-origin de las PWA. Cada ruta exporta este handler.
 */
export function preflight(req: NextRequest): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export interface ApiCtx {
  req: NextRequest;
  org: Organization;
  db: LocalDb;
}

export function withOrgApi(
  handler: (ctx: ApiCtx) => Promise<NextResponse | Response>,
): (req: NextRequest) => Promise<NextResponse | Response> {
  return async (req: NextRequest) => {
    const origin = req.headers.get("origin");
    const cors = corsHeaders(origin);
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    try {
      const db = await getDb();
      let org: Organization;
      if (deviceAuthEnabled()) {
        // Producción: la tablet se identifica por su token provisionado.
        const resolved = await resolveDevice(req, db);
        if (!resolved) return json(DEVICE_REQUIRED_ERROR, 403, cors);
        org = resolved.org;
      } else {
        const slug = req.headers.get("x-org-slug");
        if (!slug) return json({ error: "Falta el header X-Org-Slug" }, 400, cors);
        const [found] = await db.select().from(organizations).where(eq(organizations.slug, slug));
        if (!found) return json({ error: `Organización "${slug}" no encontrada` }, 404, cors);
        org = found;
      }
      // Tenant suspendido por el superadmin: nada del API le sirve (POS/KDS/carta
      // reciben el motivo y muestran "contacta a soporte").
      if (org.status === "suspended") {
        return json({ error: suspendedMessage(), code: "org_suspended" }, 403, cors);
      }
      const response = await handler({ req, org, db });
      // Toda respuesta (incluida la del handler) lleva CORS — el preflight no basta.
      for (const [key, value] of Object.entries(cors)) {
        response.headers.set(key, value);
      }
      return response;
    } catch (error) {
      console.error("[api]", error);
      return json({ error: error instanceof Error ? error.message : "Error interno" }, 500, cors);
    }
  };
}
