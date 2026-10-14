import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { recipeItems } from "@rest/db";
import { withTenant } from "@rest/db/local";
import { withOrgApi, preflight } from "@/lib/api";

/**
 * POST /api/recipes {productId, items: [{ingredientId, qty}]} — define el
 * escandallo de un producto (reemplaza la receta completa).
 */
export const POST = withOrgApi(async ({ org, db, req }) => {
  const body = (await req.json()) as {
    productId?: string;
    items?: Array<{ ingredientId: string; qty: number }>;
  };
  if (!body.productId || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "productId e items son requeridos" }, { status: 400 });
  }
  await withTenant(db, org.id, async (tx) => {
    const items = body.items ?? [];
    await tx.delete(recipeItems).where(eq(recipeItems.productId, body.productId!));
    if (items.length > 0) {
      await tx.insert(recipeItems).values(
        items.map((i) => ({
          organizationId: org.id,
          productId: body.productId!,
          ingredientId: i.ingredientId,
          qty: i.qty,
        })),
      );
    }
  });
  return NextResponse.json({ ok: true }, { status: 201 });
});

export const OPTIONS = preflight;
