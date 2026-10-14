import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { categories, diningTables, locations, memberships, organizations, products, users } from "@rest/db";
import { asRuntime, hashSecret } from "@rest/db/local";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/Ã­/g, "i").replace(/Ã¡/g, "a").replace(/Ã©/g, "e").replace(/Ã³/g, "o").replace(/Ãº/g, "u").replace(/Ã±/g, "n")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function POST(req: NextRequest) {
  // Registro cerrado (SIGNUP_OPEN=false): solo el dueño de la plataforma crea
  // cuentas (desde /superadmin o invitación directa).
  if (process.env.SIGNUP_OPEN === "false") {
    return NextResponse.json(
      { error: "Registro cerrado. Contacta a soporte para tu cuenta." },
      { status: 403 },
    );
  }
  const { restaurantName, name, email, password } = (await req.json()) as {
    restaurantName?: string;
    name?: string;
    email?: string;
    password?: string;
  };
  // El alta del superadmin no crea restaurante: restaurantName no le aplica.
  const esAltaSuperadmin =
    email?.toLowerCase().trim() === process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
  if ((!restaurantName && !esAltaSuperadmin) || !name || !email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Restaurante, nombre, email y contraseña (mín. 8) son requeridos" },
      { status: 400 },
    );
  }

  const db = await getDb();
  const normalizedEmail = email.toLowerCase().trim();

  // ── Alta del dueño de la plataforma (SUPERADMIN_EMAIL) ─────────────────────
  // Crea SOLO el usuario con rol superadmin: sin restaurante, sin local, sin
  // catálogo. Su superficie es /superadmin; el panel "/" lo redirige allí.
  if (normalizedEmail === process.env.SUPERADMIN_EMAIL?.toLowerCase().trim()) {
    const result = await asRuntime(db, async (tx) => {
      const [existing] = await tx.select().from(users).where(eq(users.email, normalizedEmail));
      if (existing) return { error: "Ese email ya tiene cuenta — inicia sesión" as const };
      const [user] = await tx
        .insert(users)
        .values({
          email: normalizedEmail,
          name: name!,
          passwordHash: hashSecret(password!),
          platformRole: "superadmin",
        })
        .returning();
      return { user };
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    const response = NextResponse.json({ ok: true, organization: null, platformAdmin: true });
    response.cookies.set(
      SESSION_COOKIE,
      createSessionToken({ uid: result.user.id, email: result.user.email, name: result.user.name }),
      sessionCookieOptions,
    );
    return response;
  }

  const result = await asRuntime(db, async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.email, normalizedEmail));
    if (existing) return { error: "Ese email ya tiene cuenta — inicia sesión" as const };

    // En este punto restaurantName está garantizado por la validación (la rama
    // superadmin ya retornó arriba).
    const nombreRestaurante = restaurantName!.trim();

    // Slug único
    let slug = slugify(nombreRestaurante);
    if (!slug) slug = "restaurante";
    for (let attempt = 0; attempt < 20; attempt++) {
      const [taken] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.slug, attempt === 0 ? slug : `${slug}-${attempt + 1}`));
      if (!taken) {
        slug = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
        break;
      }
    }

    const [org] = await tx
      .insert(organizations)
      .values({ name: nombreRestaurante, slug, plan: "free" })
      .returning();
    const [user] = await tx
      .insert(users)
      .values({
        email: normalizedEmail,
        name,
        passwordHash: hashSecret(password),
        // El email designado en SUPERADMIN_EMAIL nace superadmin (dueño de la
        // plataforma). Nadie más obtiene el rol jamás por esta vía.
        platformRole:
          normalizedEmail === process.env.SUPERADMIN_EMAIL?.toLowerCase() ? "superadmin" : null,
      })
      .returning();
    // La política RLS de memberships filtra por app.user_id — setearla antes
    // de crear la membresía (quirk de Postgres: un GUC local revertido queda '').
    await tx.execute(sql`SELECT set_config('app.user_id', ${user.id}, true)`);
    await tx
      .insert(memberships)
      .values({ userId: user.id, organizationId: org.id, role: "owner" });

    // Local inicial + catálogo arrancable: el tenant queda operativo al instante.
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${org.id}, true)`);
    const [location] = await tx
      .insert(locations)
      .values({ organizationId: org.id, name: "Principal" })
      .returning();
    const starterCategories = await tx
      .insert(categories)
      .values([
        { organizationId: org.id, name: "Entradas", sortOrder: 0 },
        { organizationId: org.id, name: "Platos fuertes", sortOrder: 1 },
        { organizationId: org.id, name: "Bebidas", sortOrder: 2 },
      ])
      .returning();
    await tx.insert(products).values([
      {
        organizationId: org.id,
        categoryId: starterCategories[0].id,
        name: "Producto de ejemplo",
        description: "Edítalo o elimínalo desde el Menú",
        priceCents: 9_900,
      },
    ]);
    await tx.insert(diningTables).values(
      Array.from({ length: 4 }, (_, i) => ({
        organizationId: org.id,
        locationId: location.id,
        name: `M${i + 1}`,
        zone: "Salón",
        seats: 4,
      })),
    );
    return { org, user };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const response = NextResponse.json({
    ok: true,
    organization: { name: result.org.name, slug: result.org.slug },
  });
  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken({ uid: result.user.id, email: result.user.email, name: result.user.name }),
    sessionCookieOptions,
  );
  return response;
}
