import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { devices } from "@rest/db";
import { getDb } from "@/lib/db";
import { audit, requireSuperadmin } from "@/lib/superadmin";
import { deviceTokenHash, newDeviceToken } from "@/lib/devices";

/** GET — lista de dispositivos del tenant (sin tokens, obviamente). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await requireSuperadmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const db = await getDb();
  const rows = await db
    .select({
      id: devices.id,
      name: devices.name,
      kind: devices.kind,
      lastSeenAt: devices.lastSeenAt,
      revokedAt: devices.revokedAt,
      createdAt: devices.createdAt,
    })
    .from(devices)
    .where(eq(devices.organizationId, id))
    .orderBy(desc(devices.createdAt));
  return NextResponse.json({ devices: rows });
}

/**
 * POST — {action:"create", name, kind} → token en claro UNA vez; o
 * {action:"revoke", deviceId} → revoca (la tablet deja de operar al instante).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await requireSuperadmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as {
    action?: string;
    name?: string;
    kind?: string;
    deviceId?: string;
  };
  const db = await getDb();

  if (body.action === "create") {
    const name = body.name?.trim();
    const kind = ["pos", "kds", "menu"].includes(body.kind ?? "") ? body.kind! : "pos";
    if (!name) return NextResponse.json({ error: "Requiere name" }, { status: 400 });
    const token = newDeviceToken();
    const [device] = await db
      .insert(devices)
      .values({ organizationId: id, name, kind, tokenHash: deviceTokenHash(token) })
      .returning({ id: devices.id });
    await audit(admin.email, "device.create", "organization", id, { name, kind });
    // El token en claro viaja UNA vez; solo se guarda el hash.
    return NextResponse.json({ ok: true, device, token });
  }

  if (body.action === "revoke") {
    if (!body.deviceId) return NextResponse.json({ error: "Requiere deviceId" }, { status: 400 });
    await db
      .update(devices)
      .set({ revokedAt: new Date() })
      .where(and(eq(devices.id, body.deviceId), eq(devices.organizationId, id)));
    await audit(admin.email, "device.revoke", "organization", id, { deviceId: body.deviceId });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action inválida" }, { status: 400 });
}
