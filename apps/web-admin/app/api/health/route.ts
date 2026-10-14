import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

/**
 * GET /api/health — sonda para monitoreo externo (Cloudflare health checks,
 * UptimeRobot) y healthcheck del compose. 200 si la DB responde, 503 si no.
 */
export async function GET(): Promise<Response> {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, ts: new Date().toISOString() });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "db error" },
      { status: 503 },
    );
  }
}
