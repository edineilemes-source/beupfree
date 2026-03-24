/**
 * Auto-approval service for whitelisted brands.
 * Evaluates a processed item and decides if it can be auto-published.
 */

// ============ Brand whitelist (normalized) ============
const BRAND_WHITELIST = new Set([
  "nike",
  "adidas",
  "olympikus",
  "mizuno",
  "puma",
  "fila",
  "jordan",
  "new balance",
  "kappa",
  "asics",
  "reebok",
  "under armour",
  "skechers",
  "vans",
  "converse",
  "mormaii",
  "penalty",
  "umbro",
  "topper",
]);

// Alias map: raw text patterns -> canonical brand
const BRAND_ALIASES: Array<[RegExp, string]> = [
  [/\bair\s+jordan\b/i, "jordan"],
  [/\bnew\s+balance\b/i, "new balance"],
  [/\bunder\s+armour\b/i, "under armour"],
  [/\bnike\b/i, "nike"],
  [/\badidas\b/i, "adidas"],
  [/\bolympikus\b/i, "olympikus"],
  [/\bmizuno\b/i, "mizuno"],
  [/\bpuma\b/i, "puma"],
  [/\bfila\b/i, "fila"],
  [/\bjordan\b/i, "jordan"],
  [/\bkappa\b/i, "kappa"],
  [/\basics\b/i, "asics"],
  [/\breebok\b/i, "reebok"],
  [/\bskechers\b/i, "skechers"],
  [/\bvans\b/i, "vans"],
  [/\bconverse\b/i, "converse"],
  [/\bmormaii\b/i, "mormaii"],
  [/\bpenalty\b/i, "penalty"],
  [/\bumbro\b/i, "umbro"],
  [/\btopper\b/i, "topper"],
];

function normalizeBrand(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect brand from title + explicit marca field.
 * Returns { brand, confidence } where confidence is 0..1.
 */
export function detectBrandForAutoApproval(
  title: string,
  marcaField?: string | null
): { brand: string | null; confidence: number } {
  const text = `${title} ${marcaField || ""}`;
  const normalizedText = normalizeBrand(text);

  const detectedBrands: string[] = [];

  for (const [pattern, canonical] of BRAND_ALIASES) {
    if (pattern.test(text)) {
      if (!detectedBrands.includes(canonical)) {
        detectedBrands.push(canonical);
      }
    }
  }

  if (detectedBrands.length === 0) {
    return { brand: null, confidence: 0 };
  }

  // Multiple brands in title = ambiguous, do not auto-approve
  if (detectedBrands.length > 1) {
    return { brand: detectedBrands[0], confidence: 0.3 };
  }

  const brand = detectedBrands[0];

  // Confidence based on where brand was found
  const titleLower = normalizeBrand(title);
  const marcaLower = normalizeBrand(marcaField || "");

  let confidence = 0.7;

  // Higher confidence if brand appears in dedicated marca field
  if (marcaLower && BRAND_WHITELIST.has(marcaLower)) {
    confidence = 0.95;
  } else if (marcaLower && marcaLower.includes(brand)) {
    confidence = 0.92;
  } else if (titleLower.startsWith(brand)) {
    // Brand at start of title = high confidence
    confidence = 0.9;
  } else if (titleLower.includes(brand)) {
    confidence = 0.82;
  }

  return { brand, confidence };
}

export interface CardValidation {
  valid: boolean;
  issues: string[];
}

/**
 * Validates that the item has a complete card for auto-approval.
 */
export function validateCard(item: {
  title: string;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  price: number;
  discountPercent?: number | null;
}): CardValidation {
  const issues: string[] = [];

  if (!item.title || item.title.trim().length < 10) {
    issues.push("title_too_short");
  }

  if (!item.sourceUrl || !/^https?:\/\//i.test(item.sourceUrl)) {
    issues.push("invalid_source_url");
  }

  if (!item.imageUrl || !/^https?:\/\//i.test(item.imageUrl)) {
    issues.push("missing_image");
  }

  if (!item.price || item.price <= 0) {
    issues.push("invalid_price");
  }

  if (
    item.discountPercent !== null &&
    item.discountPercent !== undefined &&
    (item.discountPercent < 0 || item.discountPercent > 90)
  ) {
    issues.push("discount_out_of_range");
  }

  return { valid: issues.length === 0, issues };
}

export interface AutoApproveResult {
  shouldAutoApprove: boolean;
  brand: string | null;
  confidence: number;
  issues: string[];
  reason: Record<string, unknown>;
}

const CONFIDENCE_THRESHOLD = 0.85;

/**
 * Main entry point: decides if item should be auto-approved.
 */
export function evaluateAutoApproval(item: {
  title: string;
  marcaField?: string | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  price: number;
  discountPercent?: number | null;
}): AutoApproveResult {
  const { brand, confidence } = detectBrandForAutoApproval(
    item.title,
    item.marcaField
  );

  const cardValidation = validateCard(item);
  const issues = [...cardValidation.issues];

  if (!brand || !BRAND_WHITELIST.has(brand)) {
    return {
      shouldAutoApprove: false,
      brand,
      confidence,
      issues,
      reason: { decision: "brand_not_in_whitelist", brand, confidence },
    };
  }

  if (confidence < CONFIDENCE_THRESHOLD) {
    issues.push("low_brand_confidence");
    return {
      shouldAutoApprove: false,
      brand,
      confidence,
      issues,
      reason: {
        decision: "confidence_below_threshold",
        brand,
        confidence,
        threshold: CONFIDENCE_THRESHOLD,
      },
    };
  }

  if (!cardValidation.valid) {
    return {
      shouldAutoApprove: false,
      brand,
      confidence,
      issues,
      reason: { decision: "incomplete_card", issues: cardValidation.issues },
    };
  }

  return {
    shouldAutoApprove: true,
    brand,
    confidence,
    issues: [],
    reason: { decision: "auto_approved", brand, confidence },
  };
}
