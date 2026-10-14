import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { products, whatsappMessages } from "@rest/db";
import { withTenant } from "@rest/db/local";
import { createOrderForOrg, checkPlanLimit, getOrgBySlug } from "@/lib/orders";
import { getDb } from "@/lib/db";
import { parseOrderText } from "@/lib/whatsapp";

/**
 * Webhook WhatsApp — formato Cloud API de Meta (producción) + formato simulador.
 * En producción Meta llama este endpoint con mensajes reales; el simulador del
 * admin usa el mismo contrato con {from, text}.
 * Verificación GET estilo Meta: hub.challenge.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token === (process.env.WHATSAPP_VERIFY_TOKEN ?? "rest-demo-token")) {
    return new Response(challenge ?? "ok", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

interface InboundItem {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    orgSlug?: string;
    from?: string;
    text?: string;
    // formato Meta Cloud API (producción)
    entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ from?: string; text?: { body?: string } }> } }> }>;
  };

  // Soporta ambos formatos: simulador directo y envelope de Meta
  const from = body.from ?? body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
  const text = body.text ?? body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;
  const orgSlug = body.orgSlug ?? req.headers.get("x-org-slug");
  if (!from || !text || !orgSlug) {
    return NextResponse.json({ error: "Requiere from, text y orgSlug (o envelope Meta + X-Org-Slug)" }, { status: 400 });
  }

  const db = await getDb();
  const org = await getOrgBySlug(db, orgSlug);
  if (!org) return NextResponse.json({ error: `Organización "${orgSlug}" no encontrada` }, { status: 404 });

  // 1) persistir el mensaje entrante
  await withTenant(db, org.id, async (tx) => {
    await tx.insert(whatsappMessages).values({ organizationId: org.id, waId: from, direction: "in", body: text });
  });

  // 2) parsear contra el catálogo y crear la orden (o pedir aclaración)
  const result = await withTenant(db, org.id, async (tx) => {
    return tx.select().from(products).where(eq(products.organizationId, org.id));
  });
  const items = parseOrderText(text, result.filter((p) => p.available).map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents })));

  let reply: string;
  let orderNumber: number | null = null;

  if (items.length === 0) {
    const menu = result
      .filter((p) => p.available)
      .slice(0, 8)
      .map((p) => `• ${p.name} — ${(p.priceCents / 100).toLocaleString("es-PE", { style: "currency", currency: org.currency })}`)
      .join("\n");
    reply = `¡Hola! 👋 Soy el asistente de ${org.name}. Para pedir, escribe cantidad y producto, por ejemplo:\n"2 ceviches de pescado y 1 chicha morada"\n\nNuestro menú:\n${menu}`;
  } else {
    const limitError = await checkPlanLimit(db, org.id, org.plan);
    if (limitError) {
      reply = `Lo sentimos, en este momento no podemos tomar tu pedido. Intenta más tarde.`;
    } else {
      const created = await createOrderForOrg(db, org.id, {
        channel: "whatsapp",
        items,
        clientUuid: crypto.randomUUID(),
      });
      if (!created.ok) {
        reply = "No pudimos registrar tu pedido, intenta de nuevo en unos minutos.";
      } else {
        orderNumber = created.number;
        const total = items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
        reply = `✅ Pedido #${created.number} confirmado:\n${items
          .map((i) => `${i.quantity}× ${i.name}`)
          .join("\n")}\nTotal: ${(total / 100).toLocaleString("es-PE", { style: "currency", currency: org.currency })}\nTe avisamos cuando esté listo. ¡Gracias!`;
      }
    }
  }

  // 3) persistir la respuesta automática (el proveedor real la envía por la API de Meta)
  await withTenant(db, org.id, async (tx) => {
    await tx.insert(whatsappMessages).values({
      organizationId: org.id,
      waId: from,
      direction: "out",
      body: reply,
      orderNumber,
    });
  });

  return NextResponse.json({ ok: true, orderNumber, reply });
}
