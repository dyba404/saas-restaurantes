import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { organizations } from "@rest/db";
import { getDb } from "@/lib/db";
import { corsHeaders, preflight } from "@/lib/api";
import { DEVICE_REQUIRED_ERROR, deviceAuthEnabled, resolveDevice, resolveDeviceByToken } from "@/lib/devices";
import { subscribeOrdersChanged } from "@/lib/realtime-bus";
import { suspendedMessage } from "@/lib/support";

/**
 * GET /api/realtime?org=<slug> — stream SSE con "orders.changed" por organización.
 *
 * El KDS lo consume con EventSource, que no puede mandar headers custom, así que
 * la organización va por query (?org=) con el mismo nivel de seguridad que el
 * header X-Org-Slug del resto de la API (demo F1: F1 el device token lo reemplaza).
 *
 * Heartbeat ": ping" cada 25 s para que proxies no corten la conexión.
 */
export const runtime = "nodejs"; // pglite exige Node fuera del bundle de webpack
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  const slug = req.nextUrl.searchParams.get("org") ?? req.headers.get("x-org-slug");
  if (!slug) {
    return Response.json({ error: "Falta ?org=<slug>" }, { status: 400, headers: cors });
  }
  const db = await getDb();
  let org: { id: string; status: string } | undefined;
  if (deviceAuthEnabled()) {
    // Header X-Device-Token O query ?device=<token> (EventSource no manda headers).
    const resolved = await resolveDevice(req, db).then(
      (r) => r ?? resolveDeviceByToken(db, req.nextUrl.searchParams.get("device") ?? ""),
    );
    if (!resolved) {
      return Response.json(DEVICE_REQUIRED_ERROR, { status: 403, headers: cors });
    }
    org = resolved.org;
  } else {
    const [found] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug));
    org = found;
  }
  if (!org) {
    return Response.json({ error: `Organización "${slug}" no encontrada` }, { status: 404, headers: cors });
  }
  if (org.status === "suspended") {
    return Response.json(
      { error: suspendedMessage(), code: "org_suspended" },
      { status: 403, headers: cors },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            closed = true;
          }
        }
      };

      send("retry: 3000\n\n");
      send(": conectado\n\n");

      const unsubscribe = subscribeOrdersChanged(org.id, (event) => {
        send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });
      const heartbeat = setInterval(() => send(`: ping ${Date.now()}\n\n`), 25_000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* ya cerrado por el cliente */
        }
      };
      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      ...cors,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export const OPTIONS = preflight;
