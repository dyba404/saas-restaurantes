import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { locations, shifts, staff } from "@rest/db";
import { withTenant } from "@rest/db/local";
import { withOrgApi, preflight } from "@/lib/api";

/** GET /api/shifts — turnos de la semana en curso + empleados disponibles (F5). */
export const GET = withOrgApi(async ({ org, db }) => {
  const data = await withTenant(db, org.id, async (tx) => {
    const [location] = await tx
      .select()
      .from(locations)
      .where(eq(locations.organizationId, org.id))
      .limit(1);
    const members = await tx
      .select({ id: staff.id, name: staff.name, role: staff.role })
      .from(staff)
      .where(and(eq(staff.locationId, location.id), eq(staff.active, true)));
    const week = await tx
      .select({
        id: shifts.id,
        staffId: shifts.staffId,
        staffName: staff.name,
        startsAt: shifts.startsAt,
        endsAt: shifts.endsAt,
        published: shifts.published,
      })
      .from(shifts)
      .innerJoin(staff, eq(shifts.staffId, staff.id))
      .where(and(eq(shifts.organizationId, org.id), gte(shifts.startsAt, sql`date_trunc('week', now())`)))
      .orderBy(asc(shifts.startsAt));
    return { members, week };
  });
  return NextResponse.json({
    staff: data.members,
    shifts: data.week.map((s) => ({
      id: s.id,
      staffId: s.staffId,
      staffName: s.staffName,
      startsAt: new Date(s.startsAt).toISOString(),
      endsAt: new Date(s.endsAt).toISOString(),
      published: s.published,
    })),
  });
});

/**
 * POST /api/shifts {staffId, day (0=lunes…6=domingo), startHour, endHour}
 * — crea un turno en la semana en curso.
 */
export const POST = withOrgApi(async ({ org, db, req }) => {
  const body = (await req.json()) as {
    staffId?: string;
    day?: number;
    startHour?: number;
    endHour?: number;
  };
  if (!body.staffId || body.day == null || body.startHour == null || body.endHour == null) {
    return NextResponse.json({ error: "staffId, day, startHour y endHour son requeridos" }, { status: 400 });
  }
  if (body.day < 0 || body.day > 6 || body.startHour < 0 || body.endHour > 24 || body.startHour >= body.endHour) {
    return NextResponse.json({ error: "day 0-6 y horas válidas (inicio < fin)" }, { status: 400 });
  }

  const created = await withTenant(db, org.id, async (tx) => {
    const [location] = await tx
      .select()
      .from(locations)
      .where(eq(locations.organizationId, org.id))
      .limit(1);
    // lunes de la semana actual + offset del día
    const monday = new Date(await txDateTruncWeek(tx));
    const startsAt = new Date(monday);
    startsAt.setDate(monday.getDate() + body.day!);
    startsAt.setHours(body.startHour!, 0, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setHours(body.endHour!, 0, 0, 0);
    const [shift] = await tx
      .insert(shifts)
      .values({
        organizationId: org.id,
        locationId: location.id,
        staffId: body.staffId!,
        startsAt,
        endsAt,
      })
      .returning();
    return shift;
  });
  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
});

/** GET del lunes (timestamp) vía SQL para respetar la zona del server. */
async function txDateTruncWeek(tx: Parameters<Parameters<typeof withTenant>[2]>[0]): Promise<number> {
  const result = await tx.execute(sql`SELECT date_trunc('week', now()) AS wk`);
  const rows = (result as unknown as { rows: Array<{ wk: string }> }).rows;
  return new Date(rows[0].wk).getTime();
}

export const OPTIONS = preflight;
