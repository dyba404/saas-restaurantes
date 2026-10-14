import { and, eq, gte, sql } from "drizzle-orm";
import { diningTables, locations, orders, organizations } from "@rest/db";
import type { LocalDb } from "@rest/db/local";
import { withTenant } from "@rest/db/local";
import { publishOrdersChanged } from "@/lib/realtime-bus";
import { suspendedMessage } from "@/lib/support";

/** Límites del plan — docs/00-resumen-ejecutivo.md (pricing). */
export const PLANS = {
  free: { label: "Gratis", priceCents: 0, monthlyOrders: 100, maxLocations: 1 },
  pro: { label: "Pro", priceCents: 12_900, monthlyOrders: 5_000, maxLocations: 2 },
  multi: { label: "Multi-ubicación", priceCents: 29_900, monthlyOrders: 50_000, maxLocations: 10 },
} as const;

export type PlanId = keyof typeof PLANS;

/** Uso del mes en curso + límite del plan. */
export async function getUsage(db: LocalDb, orgId: string, plan: string) {
  const planDef = PLANS[(plan as PlanId) in PLANS ? (plan as PlanId) : "free"];
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(
      and(
        eq(orders.organizationId, orgId),
        gte(orders.createdAt, sql`date_trunc('month', now())`),
      ),
    );
  return {
    plan: (plan in PLANS ? plan : "free") as PlanId,
    priceCents: planDef.priceCents,
    monthlyOrders: planDef.monthlyOrders,
    maxLocations: planDef.maxLocations,
    ordersThisMonth: Number(count),
  };
}

/** ¿El plan permite otra orden este mes? */
export async function checkPlanLimit(db: LocalDb, orgId: string, plan: string): Promise<string | null> {
  const usage = await getUsage(db, orgId, plan);
  if (usage.ordersThisMonth >= usage.monthlyOrders) {
    return `Límite del plan ${usage.plan} alcanzado (${usage.monthlyOrders} órdenes/mes). Sube de plan en Configuración → Suscripción.`;
  }
  return null;
}

export interface CreateOrderInput {
  channel: string;
  table?: string | null;
  externalRef?: string | null;
  items: Array<{
    productId?: string | null;
    name: string;
    quantity: number;
    unitPriceCents: number;
    modifierNames?: string[];
    notes?: string;
  }>;
  totalCents?: number;
  /** clientUuid del dispositivo; si falta, se genera (idempotencia de canales). */
  clientUuid?: string;
}

/**
 * Crea una orden para el tenant con folio definitivo. La usan el sync offline,
 * WhatsApp, agregadores y la API pública — una sola fuente de verdad.
 */
export async function createOrderForOrg(
  db: LocalDb,
  orgId: string,
  input: CreateOrderInput,
): Promise<{ ok: true; number: number } | { ok: false; error: string }> {
  const result = await withTenant(db, orgId, async (tx) => {
    // Tenant suspendido: no se crean órdenes por ningún canal.
    const [orgRow] = await tx
      .select({ status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, orgId));
    if (orgRow?.status === "suspended") {
      return { ok: false as const, error: suspendedMessage() };
    }
    const [location] = await tx
      .select()
      .from(locations)
      .where(eq(locations.organizationId, orgId))
      .limit(1);
    if (!location) return { ok: false as const, error: "El restaurante no tiene local configurado" };

    let tableId: string | null = null;
    if (input.table) {
      const [table] = await tx
        .select()
        .from(diningTables)
        .where(and(eq(diningTables.locationId, location.id), eq(diningTables.name, input.table)));
      tableId = table?.id ?? null;
    }

    const [{ maxNumber }] = await tx
      .select({ maxNumber: sql<number>`coalesce(max(${orders.number}), 500)` })
      .from(orders)
      .where(eq(orders.locationId, location.id));
    const number = Number(maxNumber) + 1;

    const subtotal = input.totalCents ?? input.items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
    const [order] = await tx
      .insert(orders)
      .values({
        organizationId: orgId,
        locationId: location.id,
        clientUuid: input.clientUuid ?? crypto.randomUUID(),
        number,
        channel: input.channel as typeof orders.$inferInsert.channel,
        tableId,
        status: "sent",
        subtotalCents: subtotal,
        totalCents: subtotal,
        syncedAt: new Date(),
      })
      .returning();

    if (input.items.length > 0) {
      await tx.insert((await import("@rest/db")).orderItems).values(
        input.items.map((item) => ({
          orderId: order.id,
          productId: item.productId ?? null,
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          modifiersJson: (item.modifierNames ?? []).map((name) => ({ name })),
          notes: item.notes,
          totalCents: item.quantity * item.unitPriceCents,
        })),
      );
    }
    return { ok: true as const, number };
  });
  // Orden creada (WhatsApp/agregadores/API pública): despertar al KDS por SSE.
  if (result.ok) publishOrdersChanged(orgId);
  return result;
}

/** Resuelve la organización por slug (canales y API pública). */
export async function getOrgBySlug(db: LocalDb, slug: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
  return org ?? null;
}
