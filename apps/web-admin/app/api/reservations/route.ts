import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { diningTables, locations, reservations } from "@rest/db";
import { withTenant } from "@rest/db/local";
import { withOrgApi, preflight } from "@/lib/api";

/** GET /api/reservations — lista de reservas (F3 lite). */
export const GET = withOrgApi(async ({ org, db }) => {
  const data = await withTenant(db, org.id, async (tx) => {
    const rows = await tx
      .select({ reservation: reservations, tableName: diningTables.name })
      .from(reservations)
      .leftJoin(diningTables, eq(reservations.tableId, diningTables.id))
      .orderBy(asc(reservations.startsAt))
      .limit(100);
    return rows.map(({ reservation, tableName }) => ({
      id: reservation.id,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      partySize: reservation.partySize,
      startsAt: new Date(reservation.startsAt).toISOString(),
      status: reservation.status,
      notes: reservation.notes ?? undefined,
      tableName: tableName ?? undefined,
    }));
  });
  return NextResponse.json({ reservations: data });
});

const RESERVATION_STATUSES = ["pending", "confirmed", "seated", "cancelled", "no_show"];

/** PATCH /api/reservations — cambio de estado desde el panel (confirmar/sentar/cancelar/no-show). */
export const PATCH = withOrgApi(async ({ org, db, req }) => {
  const body = (await req.json()) as { id?: string; status?: string };
  if (!body.id || !body.status || !RESERVATION_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: "Requiere id y status válido (pending|confirmed|seated|cancelled|no_show)" },
      { status: 400 },
    );
  }
  const updated = await withTenant(db, org.id, async (tx) => {
    const rows = await tx
      .update(reservations)
      .set({ status: body.status as typeof reservations.$inferSelect.status })
      .where(eq(reservations.id, body.id!))
      .returning({ id: reservations.id, status: reservations.status });
    return rows;
  });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, reservation: updated[0] });
});

/** POST /api/reservations — página pública de reservas de la carta QR. */
export const POST = withOrgApi(async ({ org, db, req }) => {
  const body = (await req.json()) as {
    name?: string;
    phone?: string;
    partySize?: number;
    startsAt?: string;
  };
  if (!body.name || !body.startsAt || !body.partySize) {
    return NextResponse.json(
      { error: "name, partySize y startsAt son requeridos" },
      { status: 400 },
    );
  }

  const created = await withTenant(db, org.id, async (tx) => {
    const [location] = await tx
      .select()
      .from(locations)
      .where(eq(locations.organizationId, org.id))
      .limit(1);
    const [reservation] = await tx
      .insert(reservations)
      .values({
        organizationId: org.id,
        locationId: location.id,
        customerName: body.name!,
        customerPhone: body.phone,
        partySize: Math.min(20, Math.max(1, body.partySize!)),
        startsAt: new Date(body.startsAt!),
        status: "pending",
      })
      .returning();
    return reservation;
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
});

export const OPTIONS = preflight;
