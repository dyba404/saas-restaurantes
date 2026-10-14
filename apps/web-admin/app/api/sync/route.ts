import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  diningTables,
  locations,
  orderItems,
  orders,
  payments,
  products,
  syncEvents,
} from "@rest/db";
import { withTenant } from "@rest/db/local";
import { checkPlanLimit } from "@/lib/orders";
import { withOrgApi, preflight } from "@/lib/api";
import { publishOrdersChanged } from "@/lib/realtime-bus";

/**
 * Endpoint del motor offline (packages/sync): recibe el outbox del dispositivo,
 * deduplica por client_uuid (índice único) y aplica cada evento en su transacción
 * con RLS. El servidor es la única verdad para el folio definitivo.
 *
 * Idempotencia: un evento ya "synced" se re-ack sin re-aplicar; uno "failed"
 * se reintenta (se re-aplica). Los acks guardan el folio para re-entregas.
 */
interface IncomingEvent {
  clientUuid: string;
  type: string;
  payload: Record<string, unknown>;
  provisionalNumber?: number;
}

interface Ack {
  clientUuid: string;
  ok: boolean;
  definitiveNumber?: number;
  error?: string;
}

export const POST = withOrgApi(async ({ org, db, req }) => {
  const body = (await req.json()) as { events?: IncomingEvent[] };
  const incoming = body.events ?? [];

  // Localización única del tenant (demo F0: 1 local; F4: por device/location)
  const [location] = await db
    .select()
    .from(locations)
    .where(eq(locations.organizationId, org.id))
    .limit(1);

  const acks: Ack[] = [];

  for (const event of incoming) {
    try {
      const ack = await withTenant(db, org.id, async (tx): Promise<Ack> => {
        // 1) ¿Ya aplicado? → re-ack con el resultado guardado
        const [existing] = await tx
          .select()
          .from(syncEvents)
          .where(eq(syncEvents.clientUuid, event.clientUuid));
        if (existing?.status === "synced") {
          const stored = (existing.resultJson ?? {}) as { definitiveNumber?: number };
          return { clientUuid: event.clientUuid, ok: true, definitiveNumber: stored.definitiveNumber };
        }

        // 2) Aplicar según el tipo
        // Límite del plan (F2 billing): el free tier topa en órdenes/mes.
        // OJO: con `tx`, no con `db` — pglite es de UNA conexión y una query
        // sobre `db` dentro de la transacción abierta se encola detrás de sí
        // misma y bloquea el server entero (deadlock).
        const planError = await checkPlanLimit(tx as unknown as Parameters<typeof checkPlanLimit>[0], org.id, org.plan);
        if (planError) throw new Error(planError);

        let definitiveNumber: number | undefined;
        let error: string | undefined;

        try {
          if (event.type === "order.create") {
            const payload = event.payload as {
              channel?: string;
              table?: string;
              items?: Array<{
                productId?: string;
                name: string;
                quantity: number;
                unitPriceCents: number;
                modifierNames?: string[];
                notes?: string;
              }>;
              totalCents: number;
            };

            let tableId: string | null = null;
            if (payload.table) {
              const [table] = await tx
                .select()
                .from(diningTables)
                .where(
                  and(eq(diningTables.locationId, location.id), eq(diningTables.name, payload.table)),
                );
              tableId = table?.id ?? null;
            }

            // ProductIds venidos del device pueden estar desactualizados (catálogo
            // cacheado, producto borrado): los validamos y el inválido va a null en
            // vez de tirar la orden entera por una FK. El nombre/precio viajan en el
            // item, así que la orden y el KDS no pierden información.
            const requestedIds = (payload.items ?? [])
              .map((item) => item.productId)
              .filter((id): id is string => typeof id === "string" && id.length > 0);
            const validIds = requestedIds.length
              ? new Set(
                  (
                    await tx
                      .select({ id: products.id })
                      .from(products)
                      .where(inArray(products.id, requestedIds))
                  ).map((p) => p.id),
                )
              : new Set<string>();

            const [{ maxNumber }] = await tx
              .select({ maxNumber: sql<number>`coalesce(max(${orders.number}), 500)` })
              .from(orders)
              .where(eq(orders.locationId, location.id));
            definitiveNumber = Number(maxNumber) + 1;

            const [order] = await tx
              .insert(orders)
              .values({
                organizationId: org.id,
                locationId: location.id,
                clientUuid: event.clientUuid,
                number: definitiveNumber,
                channel: (payload.channel ?? "pos") as typeof orders.$inferInsert.channel,
                tableId,
                status: "sent",
                subtotalCents: payload.totalCents,
                totalCents: payload.totalCents,
                syncedAt: new Date(),
              })
              .returning();

            if (payload.items?.length) {
              await tx.insert(orderItems).values(
                payload.items.map((item) => ({
                  orderId: order.id,
                  productId:
                    item.productId && validIds.has(item.productId) ? item.productId : null,
                  name: item.name,
                  quantity: item.quantity,
                  unitPriceCents: item.unitPriceCents,
                  modifiersJson: (item.modifierNames ?? []).map((name) => ({ name })),
                  notes: item.notes,
                  totalCents: item.quantity * item.unitPriceCents,
                })),
              );
            }
          } else if (event.type === "order.pay") {
            const payload = event.payload as {
              number?: number;
              method?: string;
              amountCents?: number;
              tipCents?: number;
              changeCents?: number;
            };
            if (!payload.number) throw new Error("order.pay requiere number (folio definitivo)");
            const [order] = await tx
              .select()
              .from(orders)
              .where(and(eq(orders.number, payload.number), eq(orders.locationId, location.id)));
            if (!order) throw new Error(`Orden #${payload.number} aún no sincronizada`);
            // Guardia anti doble-cobro: una orden pagada NUNCA acepta otro pago.
            if (order.status === "paid") {
              throw new Error(`Orden #${payload.number} ya está cobrada`);
            }

            await tx
              .update(orders)
              .set({ status: "paid", paidAt: new Date() })
              .where(eq(orders.id, order.id));
            await tx.insert(payments).values({
              organizationId: org.id,
              orderId: order.id,
              method: (payload.method ?? "cash") as typeof payments.$inferInsert.method,
              amountCents: payload.amountCents ?? order.totalCents,
              tipCents: payload.tipCents ?? 0,
              changeCents: payload.changeCents ?? 0,
            });
          } else if (event.type === "kds.advance") {
            const payload = event.payload as { number?: number; status?: string };
            if (!payload.number || !payload.status) {
              throw new Error("kds.advance requiere number y status");
            }
            const status = payload.status as "preparing" | "ready" | "served";
            await tx
              .update(orders)
              .set({ status })
              .where(and(eq(orders.number, payload.number), eq(orders.locationId, location.id)));
          } else if (event.type === "catalog.mark86") {
            const payload = event.payload as { productId?: string; available?: boolean };
            if (!payload.productId) throw new Error("catalog.mark86 requiere productId");
            await tx
              .update(products)
              .set({ available: payload.available ?? false, updatedAt: new Date() })
              .where(eq(products.id, payload.productId));
          } else {
            throw new Error(`Tipo de evento desconocido: ${event.type}`);
          }
        } catch (applyError) {
          error = applyError instanceof Error ? applyError.message : String(applyError);
        }

        // 3) Registrar el resultado del evento (synced o failed, con upsert)
        const resultJson = { definitiveNumber: definitiveNumber ?? null };
        await tx
          .insert(syncEvents)
          .values({
            organizationId: org.id,
            clientUuid: event.clientUuid,
            eventType: event.type,
            status: error ? "failed" : "synced",
            attempts: (existing?.attempts ?? 0) + 1,
            lastError: error,
            resultJson,
          })
          .onConflictDoUpdate({
            target: syncEvents.clientUuid,
            set: {
              status: error ? "failed" : "synced",
              attempts: (existing?.attempts ?? 0) + 1,
              lastError: error,
              resultJson,
            },
          });

        if (error) throw new Error(error);
        return { clientUuid: event.clientUuid, ok: true, definitiveNumber };
      });
      acks.push(ack);
    } catch (error) {
      acks.push({
        clientUuid: event.clientUuid,
        ok: false,
        error: error instanceof Error ? error.message : "Error aplicando evento",
      });
    }
  }

  // Al menos un evento aplicado → despertar KDS/POS conectados por SSE.
  if (acks.some((ack) => ack.ok)) publishOrdersChanged(org.id);

  return NextResponse.json({ acks });
});

export const OPTIONS = preflight;
