import {
  normalizeColorExpression,
  translateColorExpression,
} from "./attribute-extraction/dictionaries/colors";

export type ProductColorSource =
  | "marketplace_attribute"
  | "marketplace_variation";

export interface ProductColorInput {
  name: string;
  normalized: string;
  source: ProductColorSource;
  confidence: number;
}

export function normalizeColorName(value: string | null | undefined): string | null {
  return normalizeColorExpression(value);
}

export function translateColorName(value: string | null | undefined): string | null {
  return translateColorExpression(value);
}

export function cleanOfficialColorName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > 120) return null;
  return normalizeColorName(cleaned) ? cleaned : null;
}
