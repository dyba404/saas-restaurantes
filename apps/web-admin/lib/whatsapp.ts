export interface InboundItem {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
}

/** Parser simple es-PE: "2 ceviche de pescado y 1 chicha morada" → items. */
export function parseOrderText(
  text: string,
  catalog: Array<{ id: string; name: string; priceCents: number }>,
): InboundItem[] {
  const items: InboundItem[] = [];
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const product of catalog) {
    const productName = product.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const escaped = productName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // busca "2 ceviche de pescado" | "ceviche de pescado x2" | solo el nombre (x1)
    const leading = new RegExp(`(\\d+)\\s+(?:de\\s+)?${escaped}`);
    const trailing = new RegExp(`${escaped}\\s*x\\s*(\\d+)`);
    const m = normalized.match(leading) ?? normalized.match(trailing);
    const qty = m ? Number(m[1]) : normalized.includes(productName) ? 1 : 0;
    if (qty > 0) {
      items.push({
        productId: product.id,
        name: product.name,
        quantity: qty,
        unitPriceCents: product.priceCents,
      });
    }
  }
  return items;
}
