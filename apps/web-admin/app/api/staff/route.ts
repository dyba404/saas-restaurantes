import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { locations, staff } from "@rest/db";
import { hashSecret } from "@rest/db/local";
import { withTenant } from "@rest/db/local";
import { withOrgApi, preflight } from "@/lib/api";

const ROLES = ["owner", "manager", "cashier", "waiter", "kitchen"];

/**
 * POST /api/staff — alta y gestión de PIN de los empleados de piso.
 *   {action:"create", name, role, pin}   → crea empleado con PIN de tablet
 *   {action:"reset-pin", staffId, pin}   → cambia el PIN de un empleado
 * Los empleados NO crean cuenta: su acceso es el PIN en la tablet del POS.
 * El rol debe ser uno del enum staff_role (owner solo por signup del dueño).
 */
export const POST = withOrgApi(async ({ org, db, req }) => {
  const body = (await req.json()) as {
    action?: string;
    name?: string;
    role?: string;
    pin?: string;
    staffId?: string;
  };

  const pin = body.pin ?? "";
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "El PIN debe ser exactamente 4 dígitos" }, { status: 400 });
  }

  if (body.action === "create") {
    const name = body.name?.trim() ?? "";
    if (name.length < 2) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }
    if (!ROLES.includes(body.role ?? "") || body.role === "owner") {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    const created = await withTenant(db, org.id, async (tx) => {
      const [location] = await tx
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.organizationId, org.id))
        .limit(1);
      if (!location) return null;
      const [row] = await tx
        .insert(staff)
        .values({
          locationId: location.id,
          name,
          role: body.role as typeof staff.$inferInsert.role,
          pinHash: hashSecret(pin),
        })
        .returning({ id: staff.id, name: staff.name, role: staff.role });
      return row;
    });
    if (!created) {
      return NextResponse.json({ error: "El restaurante no tiene local configurado" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, staff: created });
  }

  if (body.action === "reset-pin") {
    if (!body.staffId) {
      return NextResponse.json({ error: "Requiere staffId" }, { status: 400 });
    }
    const updated = await withTenant(db, org.id, async (tx) => {
      const rows = await tx
        .select({ id: staff.id })
        .from(staff)
        .innerJoin(locations, eq(locations.id, staff.locationId))
        .where(and(eq(staff.id, body.staffId!), eq(locations.organizationId, org.id)));
      if (rows.length === 0) return false;
      await tx.update(staff).set({ pinHash: hashSecret(pin) }).where(eq(staff.id, body.staffId!));
      return true;
    });
    if (!updated) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action inválida" }, { status: 400 });
});

export const OPTIONS = preflight;
