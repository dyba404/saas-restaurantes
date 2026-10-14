import { NextResponse } from "next/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { auditLog, payments } from "@rest/db";
import { withTenant } from "@rest/db/local";
import { preflight, withOrgApi } from "@/lib/api";

const METHODS = ["cash", "card", "mercadopago", "stripe", "mixed", "payment_link"] as const;
type Method = (typeof METHODS)[number];

/**
 * GET /api/payments — totales reales del día (todas las cajas y canales).
 * Efectivo esperado en gaveta = Σ (recibido − cambio) en pagos con efectivo.
 */
export const GET = withOrgApi(async ({ org, db }) => {
  const data = await withTenant(db, org.id, async (tx) => {
    const rows = await tx
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, org.id),
          gte(payments.createdAt, sql`date_trunc('day', now())`),
        ),
      );

    const totals = Object.fromEntries(
      METHODS.map((m) => [m, { count: 0, amountCents: 0, tipCents: 0 }]),
    ) as Record<Method, { count: number; amountCents: number; tipCents: number }>;

    let expectedCashCents = 0;
    for (const p of rows) {
      const bucket = totals[p.method] ?? totals.cash;
      bucket.count += 1;
      bucket.amountCents += p.amountCents;
      bucket.tipCents += p.tipCents;
      if (p.method === "cash" || p.method === "mixed") {
        expectedCashCents += Math.max(0, p.amountCents - p.changeCents);
      }
    }

    const cortes = await tx
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.organizationId, org.id), eq(auditLog.action, "cash_close")))
      .orderBy(desc(auditLog.createdAt))
      .limit(10);

    return {
      totals,
      salesCents: rows.reduce((s, p) => s + p.amountCents, 0),
      tickets: rows.length,
      tipCents: rows.reduce((s, p) => s + p.tipCents, 0),
      expectedCashCents,
      cortes: cortes.map((c) => ({
        at: new Date(c.createdAt).toISOString(),
        ...(c.payloadJson as { countedCents: number; expectedCents: number; differenceCents: number }),
      })),
    };
  });

  return NextResponse.json(data);
});

/**
 * POST /api/payments — registrar corte de caja (arqueo) en la bitácora de
 * auditoría: {countedCents}. El esperado lo calcula el server desde la DB.
 */
export const POST = withOrgApi(async ({ org, db, req }) => {
  const body = (await req.json()) as { countedCents?: number };
  if (typeof body.countedCents !== "number" || body.countedCents < 0) {
    return NextResponse.json({ error: "countedCents es requerido" }, { status: 400 });
  }

  const result = await withTenant(db, org.id, async (tx) => {
    const rows = await tx
      .select({ amountCents: payments.amountCents, changeCents: payments.changeCents, method: payments.method })
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, org.id),
          gte(payments.createdAt, sql`date_trunc('day', now())`),
        ),
      );
    const expected = rows
      .filter((p) => p.method === "cash" || p.method === "mixed")
      .reduce((s, p) => s + Math.max(0, p.amountCents - p.changeCents), 0);
    const difference = body.countedCents! - expected;

    const [corte] = await tx
      .insert(auditLog)
      .values({
        organizationId: org.id,
        action: "cash_close",
        payloadJson: { countedCents: body.countedCents, expectedCents: expected, differenceCents: difference },
      })
      .returning();
    return { at: new Date(corte.createdAt).toISOString(), countedCents: body.countedCents, expectedCents: expected, differenceCents: difference };
  });

  return NextResponse.json({ ok: true, corte: result }, { status: 201 });
});

export const OPTIONS = preflight;
