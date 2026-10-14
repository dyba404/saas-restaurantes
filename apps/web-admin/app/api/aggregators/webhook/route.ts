import { NextRequest, NextResponse } from "next/server";
import { checkPlanLimit, createOrderForOrg, getOrgBySlug } from "@/lib/orders";
import { getDb } from "@/lib/db";

const VALID_CHANNELS = new Set(["rappi", "glovo", "pedidosya", "ubereats"]);

/**
 * Webhook de agregadores (Rappi/Glovo/PedidosYa/Uber Eats) — docs/02 módulo 7.
 * Producción: cada plataforma llama con su firma; el contrato interno es este.
 * Auto-aceptación: la orden entra directa a cocina (status sent).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    orgSlug?: string;
    platform?: string;
    externalId?: string;
    items?: Array<{ name: string; quantity: number; unitPriceCents?: number }>;
    totalCents?: number;
  };
  const { orgSlug, platform, externalId } = body;
  const items = body.items ?? [];
  if (!orgSlug || !platform || !VALID_CHANNELS.has(platform) || items.length === 0) {
    return NextResponse.json(
      { error: "Requiere orgSlug, platform (rappi|glovo|pedidosya|ubereats) e items" },
      { status: 400 },
    );
  }

  const db = await getDb();
  const org = await getOrgBySlug(db, orgSlug);
  if (!org) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });

  const limitError = await checkPlanLimit(db, org.id, org.plan);
  if (limitError) return NextResponse.json({ error: limitError }, { status: 402 });

  const created = await createOrderForOrg(db, org.id, {
    channel: platform,
    externalRef: externalId ?? null,
    items: items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents ?? Math.round((body.totalCents ?? 0) / Math.max(1, items.reduce((s, x) => s + x.quantity, 0))),
    })),
    totalCents: body.totalCents,
    clientUuid: crypto.randomUUID(),
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 500 });

  // Producción: confirmar a la plataforma. Demo: ACK interno.
  return NextResponse.json({ ok: true, orderNumber: created.number, autoAccepted: true }, { status: 201 });
}
