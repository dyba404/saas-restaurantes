import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ingredients, products, recipeItems } from "@rest/db";
import { withTenant } from "@rest/db/local";
import { withOrgApi, preflight } from "@/lib/api";

/**
 * Escandallo (F4) — insumos + recetas + costo teórico por producto.
 * GET: insumos, recetas y margen por producto (costo teórico vs precio).
 */
export const GET = withOrgApi(async ({ org, db }) => {
  const data = await withTenant(db, org.id, async (tx) => {
    const insumos = await tx.select().from(ingredients).where(eq(ingredients.organizationId, org.id));
    const prods = await tx.select().from(products).where(eq(products.organizationId, org.id));
    const recipes = await tx.select().from(recipeItems).where(eq(recipeItems.organizationId, org.id));

    const productCosts = prods.map((p) => {
      const items = recipes
        .filter((r) => r.productId === p.id)
        .map((r) => {
          const ing = insumos.find((i) => i.id === r.ingredientId);
          return {
            ingredientId: r.ingredientId,
            name: ing?.name ?? "?",
            unit: ing?.unit ?? "?",
            qty: r.qty,
            costCents: Math.round(r.qty * (ing?.costPerUnitCents ?? 0)),
          };
        });
      const costCents = items.reduce((s, i) => s + i.costCents, 0);
      const marginPct = p.priceCents > 0 ? Math.round(((p.priceCents - costCents) / p.priceCents) * 100) : 0;
      return {
        productId: p.id,
        name: p.name,
        priceCents: p.priceCents,
        costCents,
        marginPct,
        items,
      };
    });

    return {
      ingredients: insumos.map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        stockQty: i.stockQty,
        minQty: i.minQty,
        costPerUnitCents: i.costPerUnitCents,
      })),
      recipes: productCosts,
    };
  });
  return NextResponse.json(data);
});

/** POST /api/ingredients — crea insumo {name, unit, minQty, costPerUnitCents}. */
export const POST = withOrgApi(async ({ org, db, req }) => {
  const body = (await req.json()) as {
    name?: string;
    unit?: string;
    minQty?: number;
    stockQty?: number;
    costPerUnitCents?: number;
  };
  if (!body.name) return NextResponse.json({ error: "name es requerido" }, { status: 400 });
  const created = await withTenant(db, org.id, async (tx) => {
    const [ing] = await tx
      .insert(ingredients)
      .values({
        organizationId: org.id,
        name: body.name!,
        unit: body.unit ?? "kg",
        minQty: body.minQty ?? 0,
        stockQty: body.stockQty ?? 0,
        costPerUnitCents: body.costPerUnitCents ?? 0,
      })
      .returning();
    return ing;
  });
  return NextResponse.json({ ok: true, ingredient: { id: created.id, name: created.name } }, { status: 201 });
});

/** PATCH /api/ingredients {id, stockQty} — conteo físico. */
export const PATCH = withOrgApi(async ({ org, db, req }) => {
  const body = (await req.json()) as { id?: string; stockQty?: number };
  if (!body.id || typeof body.stockQty !== "number") {
    return NextResponse.json({ error: "id y stockQty son requeridos" }, { status: 400 });
  }
  await withTenant(db, org.id, async (tx) => {
    await tx
      .update(ingredients)
      .set({ stockQty: body.stockQty!, updatedAt: new Date() })
      .where(eq(ingredients.id, body.id!));
  });
  return NextResponse.json({ ok: true });
});

export const OPTIONS = preflight;
