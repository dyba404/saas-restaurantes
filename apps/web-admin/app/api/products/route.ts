import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { categories, products } from "@rest/db";
import { withTenant } from "@rest/db/local";
import { withOrgApi, preflight } from "@/lib/api";

/**
 * Escritura de catálogo — la usa el onboarding self-serve (F2) y el editor del menú.
 * GET: catálogo compacto. POST: crea producto (crea categoría "General" si no hay).
 */
export const GET = withOrgApi(async ({ org, db }) => {
  const data = await withTenant(db, org.id, async (tx) => {
    const cats = await tx.select().from(categories).where(eq(categories.organizationId, org.id));
    const prods = await tx.select().from(products).where(eq(products.organizationId, org.id));
    return {
      categories: cats.map((c) => ({ id: c.id, name: c.name })),
      products: prods.map((p) => ({
        id: p.id,
        categoryId: p.categoryId,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        available: p.available,
      })),
    };
  });
  return NextResponse.json(data);
});

export const POST = withOrgApi(async ({ org, db, req }) => {
  const body = (await req.json()) as {
    name?: string;
    priceCents?: number;
    description?: string;
    categoryName?: string;
  };
  if (!body.name || !body.priceCents || body.priceCents <= 0) {
    return NextResponse.json({ error: "name y priceCents (> 0) son requeridos" }, { status: 400 });
  }
  const created = await withTenant(db, org.id, async (tx) => {
    const categoryName = body.categoryName ?? "General";
    let [category] = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.organizationId, org.id), eq(categories.name, categoryName)));
    if (!category) {
      [category] = await tx
        .insert(categories)
        .values({ organizationId: org.id, name: categoryName, sortOrder: 99 })
        .returning();
    }
    const [product] = await tx
      .insert(products)
      .values({
        organizationId: org.id,
        categoryId: category.id,
        name: body.name!,
        description: body.description,
        priceCents: body.priceCents!,
      })
      .returning();
    return product;
  });
  return NextResponse.json({ ok: true, product: { id: created.id, name: created.name, priceCents: created.priceCents } }, { status: 201 });
});

export const OPTIONS = preflight;
