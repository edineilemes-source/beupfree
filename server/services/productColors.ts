import { db } from "../db";
import { productColors, products } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import {
  cleanOfficialColorName,
  normalizeColorName,
  type ProductColorInput,
  type ProductColorSource,
} from "@shared/colorNormalization";

export function colorsFromRawData(rawData: unknown): ProductColorInput[] {
  if (!rawData || typeof rawData !== "object") return [];
  const rawColors = (rawData as { marketplace_colors?: unknown }).marketplace_colors;
  if (!Array.isArray(rawColors)) return [];

  const colors = new Map<string, ProductColorInput>();
  for (const raw of rawColors) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const name = cleanOfficialColorName(item.name);
    const normalized = normalizeColorName(name);
    const source = item.source;
    if (
      !name ||
      !normalized ||
      (source !== "marketplace_attribute" && source !== "marketplace_variation")
    ) continue;
    colors.set(normalized, {
      name,
      normalized,
      source: source as ProductColorSource,
      confidence: 1,
    });
  }
  return Array.from(colors.values());
}

export async function persistProductColors(
  productId: string,
  inputs: ProductColorInput[],
): Promise<void> {
  const valid = new Map<string, ProductColorInput>();
  for (const input of inputs) {
    const name = cleanOfficialColorName(input.name);
    const normalized = normalizeColorName(input.normalized || name);
    if (!name || !normalized || input.confidence < 0 || input.confidence > 1) continue;
    valid.set(normalized, { ...input, name, normalized });
  }
  if (valid.size === 0) return;

  await db.transaction(async (tx) => {
    for (const color of Array.from(valid.values())) {
      await tx.insert(productColors).values({
        productId,
        colorName: color.name,
        normalizedColor: color.normalized,
        source: color.source,
        confidence: String(color.confidence),
      }).onConflictDoUpdate({
        target: [productColors.productId, productColors.normalizedColor],
        set: {
          colorName: color.name,
          source: color.source,
          confidence: sql`GREATEST(${productColors.confidence}, EXCLUDED.confidence)`,
          updatedAt: new Date(),
        },
      });
    }

    await tx.update(products).set({
      primaryColor: valid.size === 1 ? Array.from(valid.values())[0].name : null,
      updatedAt: new Date(),
    }).where(eq(products.id, productId));
  });
}
