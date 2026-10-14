import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { whatsappMessages } from "@rest/db";
import { withTenant } from "@rest/db/local";
import { withOrgApi, preflight } from "@/lib/api";

/** GET /api/whatsapp/messages — conversaciones de WhatsApp del restaurante. */
export const GET = withOrgApi(async ({ org, db }) => {
  const rows = await withTenant(db, org.id, async (tx) => {
    return tx
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.organizationId, org.id))
      .orderBy(asc(whatsappMessages.createdAt))
      .limit(500);
  });
  // agrupar por cliente (últimos primero)
  const conversations = new Map<string, typeof rows>();
  for (const msg of rows) {
    const list = conversations.get(msg.waId) ?? [];
    list.push(msg);
    conversations.set(msg.waId, list);
  }
  return NextResponse.json({
    conversations: Array.from(conversations.entries())
      .reverse()
      .map(([waId, msgs]) => ({
        waId,
        messages: msgs.map((m) => ({
          direction: m.direction,
          body: m.body,
          orderNumber: m.orderNumber,
          createdAt: new Date(m.createdAt).toISOString(),
        })),
      })),
  });
});

export const OPTIONS = preflight;
