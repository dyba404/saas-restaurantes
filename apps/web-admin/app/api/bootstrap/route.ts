import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import {
  categories,
  diningTables,
  locations,
  modifierGroups,
  modifiers,
  productModifierGroups,
  products,
} from "@rest/db";
import { withTenant } from "@rest/db/local";
import { withOrgApi, preflight } from "@/lib/api";

/**
 * Bootstrap offline-first: todo lo que una tablet necesita para operar el día.
 * El cliente lo cachea (service worker + IndexedDB) — ver docs/03-arquitectura.md.
 */
export const GET = withOrgApi(async ({ org, db }) => {
  const data = await withTenant(db, org.id, async (tx) => {
    // "Ensure" idempotente: un tenant sin local (creado antes de este fix) lo obtiene aquí.
    let [location] = await tx
      .select()
      .from(locations)
      .where(eq(locations.organizationId, org.id))
      .limit(1);
    if (!location) {
      [location] = await tx
        .insert(locations)
        .values({ organizationId: org.id, name: "Principal" })
        .returning();
    }

    const cats = await tx
      .select()
      .from(categories)
      .where(eq(categories.organizationId, org.id))
      .orderBy(asc(categories.sortOrder));

    const prods = await tx
      .select()
      .from(products)
      .where(eq(products.organizationId, org.id))
      .orderBy(asc(products.name));

    const groups = await tx
      .select()
      .from(modifierGroups)
      .where(eq(modifierGroups.organizationId, org.id));

    const mods = await tx.select().from(modifiers);
    const links = await tx.select().from(productModifierGroups);

    const tables = await tx
      .select()
      .from(diningTables)
      .where(eq(diningTables.locationId, location.id))
      .orderBy(asc(diningTables.name));

    const groupsFor = (productId: string) =>
      links
        .filter((l) => l.productId === productId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((link) => {
          const group = groups.find((g) => g.id === link.modifierGroupId)!;
          return {
            id: group.id,
            name: group.name,
            required: group.required,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            modifiers: mods
              .filter((m) => m.groupId === group.id)
              .map((m) => ({ id: m.id, name: m.name, priceCents: m.priceCents })),
          };
        });

    return {
      organization: { name: org.name, slug: org.slug, currency: org.currency },
      location: { id: location.id, name: location.name },
      categories: cats.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder })),
      products: prods.map((p) => ({
        id: p.id,
        categoryId: p.categoryId,
        name: p.name,
        description: p.description ?? undefined,
        priceCents: p.priceCents,
        available: p.available,
        modifierGroups: groupsFor(p.id),
      })),
      tables: tables.map((t) => ({ id: t.id, name: t.name, zone: t.zone, status: t.status })),
    };
  });

  return NextResponse.json(data);
});

export const OPTIONS = preflight;
