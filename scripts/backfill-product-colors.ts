import "dotenv/config";
import { pool } from "../server/db";
import { mercadoLivreService } from "../server/services/mercadolivre";
import { persistProductColors } from "../server/services/productColors";
import type { ProductColorInput } from "../shared/colorNormalization";

const execute = process.argv.includes("--execute");

interface ProductOfferRow {
  product_id: string;
  external_id: string;
}

async function main(): Promise<void> {
  const { rows } = await pool.query<ProductOfferRow>(`
    SELECT DISTINCT p.id AS product_id, o.external_id
    FROM products p
    JOIN offers o ON o.product_id = p.id
    WHERE p.catalog_status = 'published'
      AND o.external_id IS NOT NULL
      AND btrim(o.external_id) <> ''
    ORDER BY p.id, o.external_id
  `);

  const externalIds = Array.from(new Set(rows.map((row) => row.external_id)));
  const enrichment = await mercadoLivreService.getProductDetailsBatched(externalIds);
  const detailsById = new Map(enrichment.products.map((detail) => [detail.id, detail]));
  const idsByProduct = new Map<string, string[]>();
  for (const row of rows) {
    const ids = idsByProduct.get(row.product_id) ?? [];
    ids.push(row.external_id);
    idsByProduct.set(row.product_id, ids);
  }

  let productsWithColor = 0;
  let productsWithMultipleColors = 0;
  let productsWithoutColor = 0;
  let failedProducts = 0;

  for (const [productId, ids] of Array.from(idsByProduct.entries())) {
    const colors = new Map<string, ProductColorInput>();
    let successfulDetails = 0;
    for (const id of ids) {
      const detail = detailsById.get(id);
      if (!detail) continue;
      successfulDetails++;
      for (const color of mercadoLivreService.extractOfficialColors(detail)) {
        colors.set(color.normalized, color);
      }
    }

    if (successfulDetails === 0) failedProducts++;
    if (colors.size === 0) productsWithoutColor++;
    else {
      productsWithColor++;
      if (colors.size > 1) productsWithMultipleColors++;
      if (execute) await persistProductColors(productId, Array.from(colors.values()));
    }
  }

  console.log(JSON.stringify({
    mode: execute ? "execute" : "dry-run",
    productsAnalyzed: idsByProduct.size,
    productsWithColor,
    productsWithMultipleColors,
    productsWithoutColor,
    failedProducts,
    failedExternalItems: enrichment.failedIds.length,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("Backfill de cores falhou:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
