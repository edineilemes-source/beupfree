import { normalizeAttributeText } from "../attribute-extraction/normalization";
import { COLOR_DICTIONARY } from "../attribute-extraction/dictionaries/colors";

export interface ProductIdentityInput {
  name: string; brand?: string | null;
  size?: { value: string; system: string };
  /** Only validated global trade item numbers are used as cross-merchant evidence. */
  gtin?: string;
  /** Manufacturer-scoped part number; never a merchant/AWIN product ID. */
  mpn?: string;
}
export interface MasterProductIdentity {
  brand: string | null; productType: string | null; modelTokens: string[];
  modelFamily: string | null; version: string | null; versionTokens: string[];
  technicalQualifiers: string[];
}
export interface VariantIdentity {
  audience: string[]; colors: string[];
  size: { value: string; system: string } | null;
  gtin: string | null; mpn: string | null;
  ambiguities: string[];
}
export interface ProductIdentity {
  raw: ProductIdentityInput;
  master: MasterProductIdentity;
  variant: VariantIdentity;
  brand: string | null;
  productType: string | null;
  modelTokens: string[];
  modelFamily: string | null;
  version: string | null;
  versionTokens: string[];
  technicalQualifiers: string[];
  audience: string[];
  colors: string[];
  normalizedTokens: string[];
  ambiguities: string[];
}

const brands = ["aramis", "new balance", "under armour", "mizuno", "fila", "skechers", "bibi", "olympikus", "reebok", "puma", "joma", "nike", "adidas", "asics", "umbro", "penalty"];
const types: Record<string, string> = { tenis: "SNEAKER", sneaker: "SNEAKER", sneakers: "SNEAKER", sapatenis: "SNEAKER", chuteira: "FOOTBALL_BOOT", chuteiras: "FOOTBALL_BOOT", sandalia: "SANDAL", chinelo: "SLIPPER", bota: "BOOT", camiseta: "SHIRT" };
// Same audience labels as the operational catalog; no dependency on a partner adapter.
const audiences: Record<string, string> = { feminino: "FEMININO", feminina: "FEMININO", mulher: "FEMININO", women: "FEMININO", female: "FEMININO", masculino: "MASCULINO", masculina: "MASCULINO", homem: "MASCULINO", men: "MASCULINO", male: "MASCULINO", infantil: "INFANTIL", kid: "INFANTIL", kids: "INFANTIL", crianca: "INFANTIL", menino: "INFANTIL", menina: "INFANTIL", baby: "INFANTIL", bebe: "INFANTIL", unisex: "UNISSEX", unissex: "UNISSEX" };
const qualifiers = new Set("low mid high pro se ps jr fg tf md academy club elite slip-on bdp".split(" "));
const roman = new Map("i ii iii iv v vi vii viii ix x xi xii xiii xiv xv xvi xvii xviii xix xx".split(" ").map((v, i) => [v, String(i + 1)]));
// Bare integers are generations only for reviewed brand/family combinations.
const numberedFamilies: Record<string, string[]> = {
  olympikus: ["flutua", "eros"], fila: ["float maxxi"], reebok: ["floatzig"],
  puma: ["carina"], "under armour": ["charged wing"],
};
const sorted = (values: string[]) => Array.from(new Set(values)).sort();
const sameBag = (a: string[], b: string[]) => [...a].sort().join(" ") === [...b].sort().join(" ");

function tokenize(value: string): string[] {
  // Unlike the generic attribute tokenizer, retain decimal generation markers.
  return value.normalize("NFKC").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\bslip[\s-]+on\b/g, "slipon")
    .match(/[a-z0-9]+(?:\.[0-9]+)*/g)?.map(t => t === "slipon" ? "slip-on" : t) ?? [];
}

// Identity-only extension: does not change taxonomy or operational color rules.
// Keep precise colorway descriptors distinct; sand is not automatically beige.
export const IDENTITY_COLOR_ALIASES = [
  ...COLOR_DICTIONARY.flatMap(c => c.aliases.map(alias => ({ parts: tokenize(alias), value: c.value }))),
  ...["coral", "chalk", "sand", "taupe", "cream", "ivory", "olive", "teal", "mint", "lavender", "salmon", "burgundy"].map(value => ({ parts: [value], value })),
].sort((a, b) => b.parts.length - a.parts.length);

function validGtin(raw: string | undefined): string | null {
  if (!raw || /^(\d)\1+$/.test(raw) || !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(raw)) return null;
  const digits = [...raw].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((total, digit, i) => total + digit * (i % 2 ? 1 : 3), 0);
  return (10 - sum % 10) % 10 === check ? raw.padStart(14, "0") : null;
}

export function parseProductIdentity(input: ProductIdentityInput): ProductIdentity {
  const normalizedTokens = tokenize(input.name);
  let tokens = [...normalizedTokens];
  const ambiguities: string[] = [];
  const titleBrands = brands.filter(b => ` ${tokens.join(" ")} `.includes(` ${b} `));
  const suppliedBrand = normalizeAttributeText(input.brand) || null;
  const brand = suppliedBrand ?? (titleBrands.length === 1 ? titleBrands[0] : null);
  if (titleBrands.length > 1 || (suppliedBrand && titleBrands.some(b => b !== suppliedBrand))) ambiguities.push("BRAND_EVIDENCE_CONFLICT");
  if (brand) {
    const parts = brand.split(" ");
    const start = tokens.findIndex((_, i) => tokens.slice(i, i + parts.length).join(" ") === brand);
    if (start >= 0) tokens.splice(start, parts.length);
  }
  const variantAmbiguities: string[] = [];
  let size = input.size ? { value: normalizeAttributeText(input.size.value), system: normalizeAttributeText(input.size.system) } : null;
  // Explicit size labels only; unlabelled numbers remain model evidence.
  const sizeIndex = tokens.findIndex(t => ["tamanho", "tam", "size"].includes(t));
  if (sizeIndex >= 0) {
    variantAmbiguities.push("TITLE_SIZE_UNSCOPED");
    tokens.splice(sizeIndex, /^\d+(?:\.\d+)?$/.test(tokens[sizeIndex + 1] ?? "") ? 2 : 1);
  }
  if (size && (!size.value || !size.system)) { size = null; variantAmbiguities.push("INVALID_SIZE"); }
  const audience = sorted(tokens.flatMap(t => [
    ...(audiences[t] ? [audiences[t]] : []),
    ...(["baby", "bebe"].includes(t) ? ["BABY"] : []),
    ...(t === "menina" ? ["FEMININO"] : t === "menino" ? ["MASCULINO"] : []),
  ]));
  tokens = tokens.filter(t => !audiences[t]);
  // Only leading product-type words are consumed: model words remain evidence.
  const productType = types[tokens[0]] ?? null;
  if (productType) tokens.shift();
  const colors: string[] = [];
  const colorAliases = IDENTITY_COLOR_ALIASES;
  // Colors are removed only from a suffix, avoiding arbitrary deletion inside models.
  let connectedColor = false;
  while (tokens.length) {
    const color = colorAliases.find(c => tokens.slice(-c.parts.length).join(" ") === c.parts.join(" "));
    if (!color) break;
    // A new descriptor before an already extracted color can still be a model
    // word ("Easy Sand Cinza"). Require an explicit colorway separator there.
    const extended = !COLOR_DICTIONARY.some(c => c.value === color.value);
    const separator = new RegExp(`\\b${color.parts.join("[\\s-]+")}\\s*[/,+&-]`, "i").test(input.name);
    if (extended && colors.length && !connectedColor && !separator) {
      ambiguities.push("COLOR_MODEL_BOUNDARY_UNCERTAIN");
      break;
    }
    colors.push(color.value);
    tokens.splice(-color.parts.length);
    connectedColor = tokens.at(-1) === "e";
    if (connectedColor) tokens.pop();
  }
  const technicalQualifiers = sorted(tokens.filter(t => qualifiers.has(t)));
  tokens = tokens.filter(t => !qualifiers.has(t));
  const versionTokens: string[] = [];
  const versions: string[] = [];
  tokens = tokens.filter((t, index) => {
    // Single Roman letters inside model text (Fresh Foam X, X Ray) remain model evidence.
    // Multi-letter Roman generations preserve V1 order independence.
    const value = /^v\d+$/.test(t) ? String(Number(t.slice(1))) : /^\d+\.\d+$/.test(t) ? String(Number(t)) : t.length > 1 || index === tokens.length - 1 ? roman.get(t) : undefined;
    if (value === undefined) return true;
    versionTokens.push(t); versions.push(value); return false;
  });
  const withoutIntegers = tokens.filter(t => !/^\d+$/.test(t));
  if (brand && numberedFamilies[brand]?.some(f => sameBag(f.split(" "), withoutIntegers))) {
    tokens = tokens.filter(t => {
      if (!/^[1-9]\d?$/.test(t)) return true;
      versionTokens.push(t); versions.push(String(Number(t))); return false;
    });
  }
  if (versions.length > 1) ambiguities.push("MULTIPLE_VERSION_SIGNALS");
  const modelTokens = [...tokens].sort();
  const master: MasterProductIdentity = { brand, productType, modelTokens, modelFamily: modelTokens.join(" ") || null,
    version: versions.length === 1 ? versions[0] : null, versionTokens: [...versionTokens].sort(),
    technicalQualifiers };
  const gtin = validGtin(input.gtin);
  if (input.gtin && !gtin) variantAmbiguities.push("INVALID_GTIN");
  const variant: VariantIdentity = { audience, colors: sorted(colors), size, gtin,
    mpn: input.mpn?.trim().toUpperCase() || null, ambiguities: variantAmbiguities };
  return { ...master, audience, colors: variant.colors, normalizedTokens, ambiguities,
    master, variant, raw: { ...input, ...(input.size ? { size: { ...input.size } } : {}) } };
}
