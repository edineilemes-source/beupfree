export type ProductUniverse = "SNEAKER_CONFIRMED" | "SNEAKER_PROBABLE" | "NON_SNEAKER" | "UNRESOLVED";
export type ProductStyle = "PERFORMANCE" | "SPORTSWEAR" | "LIFESTYLE" | "HYBRID" | "UNKNOWN";
export type ProductActivity = "RUNNING" | "WALKING" | "TRAINING" | "FOOTBALL" | "FUTSAL" | "BASKETBALL" | "TENNIS_COURT" | "VOLLEYBALL" | "SKATE" | "TRAIL" | "OTHER_SPORT" | "GENERAL" | "UNKNOWN";
export type TaxonomyConfidence = "HIGH" | "MEDIUM" | "LOW";
export type TaxonomyReason =
  | "CATEGORY_EXPLICIT_SNEAKER" | "CATEGORY_GENERIC_FOOTWEAR" | "NAME_SNEAKER_SIGNAL"
  | "STRUCTURED_ATTRIBUTE_SIGNAL" | "CATEGORY_ACTIVITY_SIGNAL" | "NAME_ACTIVITY_SIGNAL"
  | "DESCRIPTION_ACTIVITY_SIGNAL" | "NEGATIVE_FOOTWEAR_SIGNAL" | "CONFLICTING_SIGNALS"
  | "NEGATIVE_NON_SNEAKER_SIGNAL" | "NEGATIVE_ACCESSORY_SIGNAL"
  | "DEMOGRAPHIC_PREFIX_REMOVED" | "BRAND_PHRASE_REMOVED" | "CONTEXTUAL_SNEAKER_SIGNAL" | "GENERIC_SHOE_CONTEXT"
  | "INSUFFICIENT_EVIDENCE" | "STYLE_PERFORMANCE_SIGNAL" | "STYLE_SPORTSWEAR_SIGNAL"
  | "STYLE_LIFESTYLE_SIGNAL" | "MULTIPLE_ACTIVITY_SIGNALS";

export type ProductTaxonomyInput = {
  merchantCategory?: unknown; categoryPath?: unknown; secondCategory?: unknown; thirdCategory?: unknown;
  productType?: unknown; fashionCategory?: unknown; attributes?: unknown; name?: unknown;
  description?: unknown; brand?: unknown;
};
export type ProductTaxonomyResult = {
  universe: ProductUniverse; style: ProductStyle; activities: ProductActivity[];
  confidence: TaxonomyConfidence; reasons: TaxonomyReason[]; evidence: string[];
};

const fold = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const has = (text: string, expression: RegExp) => expression.test(` ${text} `);
const sneaker = /\b(tenis|sneakers?|sapatenis|chuteiras?)\b/;
// Product-type prefixes avoid treating accessory/model words anywhere in the name as types.
const accessory = /^(?:(?:kit|packs?)\s+(?:\d+\s+)?(?:packs?\s+)?(?:de\s+)?)?(bolas?|raquetes?|overgrips?|grips?|munhequeiras?|redes?|cordas?|faixas? de cabeca)\b/;
const footwearCategory = /\b(chuteiras?|sneakers?|sapatenis|calcados? de (tenis|treino|corrida|basquete)|tenis (casual|running|corrida|training|treino|performance|sportswear|caminhada|trail|futsal|basquete|de quadra|volei|skate))\b/;
const leadingFootwear = /^(?:(?:kit|pack)\s+(?:\d+\s+)?(?:de\s+)?)?(tenis|sneakers?|sapatenis|chuteiras?)\b/;
const genericFootwear = /\b(calcados?|footwear)\b/;
const negative = /\b(sandalias?|chinelos?|rasteiras?|sapatilhas?|scarpins?|botas?|mocassim|mocassins|oxfords?|sapatos?|papetes?)\b/;
const negativeProduct = /\b(mochilas?|camisetas?|camisas?|calcoes?|shorts?|bolsas?|meias?|bones?|acessorios?|conjuntos?)\b/;

const activityRules: Array<[Exclude<ProductActivity,"GENERAL"|"UNKNOWN">, RegExp]> = [
  ["FUTSAL", /\bfutsal\b/], ["FOOTBALL", /\b(futebol|football|chuteira|society|campo)\b/],
  ["BASKETBALL", /\b(basquete|basketball)\b/], ["TENNIS_COURT", /\b(tennis court|tenis de quadra|court tennis|esportes?\s*>\s*tenis)\b/],
  ["VOLLEYBALL", /\b(volei|voleibol|volleyball)\b/], ["TRAIL", /\b(trail|trilha)\b/],
  ["RUNNING", /\b(corrida|running|runner|jogging)\b/], ["WALKING", /\b(caminhada|walking)\b/],
  ["TRAINING", /\b(treino|training|academia|crossfit|fitness)\b/], ["SKATE", /\b(skate|sk8)\b/],
  ["OTHER_SPORT", /\b(esportivo|sport)\b/],
];

function signals(text: string) { return activityRules.filter(([, rule]) => has(text, rule)).map(([activity]) => activity); }
function unique<T>(items: T[]): T[] { return Array.from(new Set(items)); }

// Normalize presentation prefixes without accepting arbitrary words before a product type.
function productName(value: string): string {
  return value.trim().replace(/^(?:(?:infantil|juvenil|adulto|bebe|kids?|masculino|feminino|unissex)\s*[-–—:]\s*)+/, "");
}
const specificNegative = /\b(sandalias?|chinelos?|rasteiras?|sapatilhas?|scarpins?|botas?|mocassim|mocassins|oxfords?|papetes?|loafers?|dockside|derby|derbies|sapato social|sapatos sociais)\b/;
const shoe = /\bsapatos?\b/;
const shoeType = /^(?:(?:kit|pack)\s+(?:\d+\s+)?(?:de\s+)?)?sapatos?\b/;
const slipOnType = /^slip[ -]on\b/;

function describesSneaker(text: string): boolean {
  const body = text.slice(0, 650);
  if (/\bnao\s+(?:e|sao|se trata de)\s+(?:um\s+)?(?:tenis|sapatenis|sneakers?)\b/.test(body)) return false;
  return /^(?:tenis|sapatenis|sneakers?)\b/.test(body.trim()) ||
    /\b(?:o|os|este|estes|esse|esses|nosso|nossos|um|1)\s+(?:novo\s+)?(?:tenis|sapatenis|sneakers?)\b/.test(body) ||
    /\blinha de sapatenis\b/.test(body);
}

export function classifyProductTaxonomy(input: ProductTaxonomyInput): ProductTaxonomyResult {
  const category = fold([input.merchantCategory,input.categoryPath,input.secondCategory,input.thirdCategory,input.productType,input.fashionCategory].join(" "));
  const attributes = fold(typeof input.attributes === "string" ? input.attributes : JSON.stringify(input.attributes ?? {}));
  const originalName = fold(input.name), description = fold(input.description);
  let name = productName(originalName);
  const prefixRemoved = name !== originalName.trim();
  // A declared multiword brand embedded after the type is provenance, not a shoe type.
  const brand = fold(input.brand).trim();
  const brandIndex = brand.split(/\s+/).length >= 3 && !has(brand.split(/\s+/)[0], negative) && !has(brand.split(/\s+/)[0], sneaker) ? name.indexOf(brand) : -1;
  const brandRemoved = brandIndex > 0;
  if (brandRemoved) name = name.slice(0, brandIndex) + " " + name.slice(brandIndex + brand.length);
  // Feed headings can be glued to the following article ("PRODUTOO tênis").
  const descriptionBody = description.split(/\btags\s*:/)[0].replace(/descricao\s+do\s+produto/g, " ");
  const nameAccessory = accessory.test(name.trim());
  const categorySneaker = has(category, footwearCategory);
  const attributeSneaker = has(attributes, sneaker);
  const structuredSneaker = categorySneaker || attributeSneaker;
  const contextualType = (shoeType.test(name) || slipOnType.test(name)) &&
    has(name, sneaker) && structuredSneaker && describesSneaker(descriptionBody) &&
    !has(name, specificNegative) && !has(descriptionBody.slice(0, 300), specificNegative);
  // Generic "sapato" is compatible with an explicitly described sneaker; specific types are not.
  const describedShoe = shoeType.test(name) && structuredSneaker &&
    describesSneaker(descriptionBody) && !has(name, specificNegative) &&
    !has(descriptionBody.slice(0, 300), specificNegative);
  const nameSneaker = leadingFootwear.test(name.trim()) || contextualType || describedShoe;
  const genericShoeContext = nameSneaker && has(name, shoe) && structuredSneaker && describesSneaker(descriptionBody);
  const categoryNegative = has(category, negative);
  // Mocassim/loafer can name a sneaker subtype, but a second bundled shoe remains conflicting.
  const sneakerSubtype = leadingFootwear.test(name.trim()) && structuredSneaker && describesSneaker(descriptionBody) &&
    has(name, /\b(mocassim|mocassins|loafers?)\b/) &&
    !has(name, /(?:\be\b|\bcom\b|[+/])\s*(?:um\s+)?(?:mocassim|mocassins|loafers?)\b/) &&
    !has(name, /\b(sandalias?|chinelos?|rasteiras?|sapatilhas?|scarpins?|botas?|oxfords?|papetes?|derby|derbies)\b/);
  const specificNameNegative = (has(name, specificNegative) && !sneakerSubtype) || (shoeType.test(name) && has(descriptionBody.slice(0, 300), specificNegative));
  const descriptionSneaker = structuredSneaker && describesSneaker(descriptionBody);
  const nameNegative = specificNameNegative || (has(name, shoe) && !genericShoeContext);
  const nameNonSneaker = has(name, negativeProduct);
  const reasons: TaxonomyReason[] = [], evidence: string[] = [];
  if (prefixRemoved) { reasons.push("DEMOGRAPHIC_PREFIX_REMOVED"); evidence.push("name:demographic_prefix"); }
  if (brandRemoved) { reasons.push("BRAND_PHRASE_REMOVED"); evidence.push("brand:declared_phrase"); }
  if (contextualType || describedShoe || sneakerSubtype) { reasons.push("CONTEXTUAL_SNEAKER_SIGNAL"); evidence.push("description:explicit_sneaker_with_structured_support"); }
  if (genericShoeContext) { reasons.push("GENERIC_SHOE_CONTEXT"); evidence.push("name:generic_shoe_with_sneaker_context"); }
  if (categorySneaker) { reasons.push("CATEGORY_EXPLICIT_SNEAKER"); evidence.push("category:sneaker"); }
  if (attributeSneaker) { reasons.push("STRUCTURED_ATTRIBUTE_SIGNAL"); evidence.push("attribute:sneaker"); }
  if (nameSneaker) { reasons.push("NAME_SNEAKER_SIGNAL"); evidence.push("name:sneaker"); }
  if (has(category, genericFootwear)) { reasons.push("CATEGORY_GENERIC_FOOTWEAR"); evidence.push("category:footwear"); }
  if (categoryNegative || nameNegative) { reasons.push("NEGATIVE_FOOTWEAR_SIGNAL"); evidence.push(categoryNegative ? "category:negative_footwear" : "name:negative_footwear"); }
  if (nameNonSneaker) { reasons.push("NEGATIVE_NON_SNEAKER_SIGNAL"); evidence.push("name:negative_non_sneaker"); }
  if (nameAccessory) { reasons.push("NEGATIVE_ACCESSORY_SIGNAL"); evidence.push("name:accessory"); }

  let universe: ProductUniverse, confidence: TaxonomyConfidence;
  const positive = categorySneaker || attributeSneaker || nameSneaker;
  if (!nameAccessory && specificNameNegative && descriptionSneaker) {
    universe = "SNEAKER_PROBABLE"; confidence = "LOW"; reasons.push("CONFLICTING_SIGNALS");
  } else if (nameAccessory || ((specificNameNegative || nameNonSneaker) && !nameSneaker)) {
    universe = "NON_SNEAKER"; confidence = "HIGH";
  } else if (nameNegative && !positive) {
    universe = "UNRESOLVED"; confidence = "LOW"; reasons.push("INSUFFICIENT_EVIDENCE");
  } else if (((categoryNegative && !nameSneaker) || nameNegative || nameNonSneaker) && positive) {
    universe = "SNEAKER_PROBABLE"; confidence = "LOW"; reasons.push("CONFLICTING_SIGNALS");
  } else if (categorySneaker && (nameSneaker || attributeSneaker)) {
    universe = "SNEAKER_CONFIRMED"; confidence = "HIGH";
  } else if (categorySneaker || attributeSneaker) {
    universe = "SNEAKER_CONFIRMED"; confidence = "HIGH";
  } else if (nameSneaker) {
    universe = "SNEAKER_CONFIRMED"; confidence = "HIGH";
  } else if (has(category, genericFootwear) && signals(`${category} ${name}`).length) {
    universe = "SNEAKER_PROBABLE"; confidence = "LOW";
  } else {
    universe = "UNRESOLVED"; confidence = "LOW"; reasons.push("INSUFFICIENT_EVIDENCE");
  }

  const categoryActivities = signals(category), nameActivities = signals(name), descriptionActivities = signals(description);
  if (categoryActivities.length) reasons.push("CATEGORY_ACTIVITY_SIGNAL");
  if (nameActivities.length) reasons.push("NAME_ACTIVITY_SIGNAL");
  if (descriptionActivities.length) reasons.push("DESCRIPTION_ACTIVITY_SIGNAL");
  let activities: ProductActivity[] = unique<ProductActivity>([...categoryActivities, ...nameActivities]);
  if (!activities.length) activities = unique(descriptionActivities);
  if (activities.includes("OTHER_SPORT") && activities.length > 1) activities = activities.filter(value => value !== "OTHER_SPORT");
  if (activities.length > 1) reasons.push("MULTIPLE_ACTIVITY_SIGNALS");

  const performance = has(`${category} ${attributes} ${name}`, /\b(performance|corrida|running|runner|treino|training|academia|futebol|futsal|basquete|basketball|trail|caminhada|walking|fitness|chuteira)\b/);
  const sportswear = has(`${category} ${attributes} ${name}`, /\b(sportswear|sportwear)\b/);
  const lifestyle = has(`${category} ${attributes} ${name}`, /\b(lifestyle|casual|urbano|street|dia a dia|sapatenis)\b/);
  if (performance) reasons.push("STYLE_PERFORMANCE_SIGNAL"); if (sportswear) reasons.push("STYLE_SPORTSWEAR_SIGNAL"); if (lifestyle) reasons.push("STYLE_LIFESTYLE_SIGNAL");
  const styles = [performance && "PERFORMANCE", sportswear && "SPORTSWEAR", lifestyle && "LIFESTYLE"].filter(Boolean);
  const style: ProductStyle = styles.length > 1 ? "HYBRID" : (styles[0] as ProductStyle | undefined) ?? "UNKNOWN";
  if (!activities.length) activities = [universe === "SNEAKER_CONFIRMED" || universe === "SNEAKER_PROBABLE" ? "GENERAL" : "UNKNOWN"];
  return { universe, style, activities, confidence, reasons:unique(reasons), evidence };
}

export type CatalogEligibility = "IN_SCOPE_CONFIRMED" | "IN_SCOPE_PROBABLE" | "OUT_OF_SCOPE_CONFIRMED" | "REVIEW_REQUIRED";
export type CommercialRequirements = {
  promotionConfirmed:boolean; validCurrentPrice:boolean; validOldPrice:boolean; discountConsistent:boolean;
  imageAvailable:boolean; brandAvailable:boolean; affiliateAvailable:boolean; inStock:boolean; identitySufficient:boolean;
};
export function classifyCatalogEligibility(taxonomy: ProductTaxonomyResult, commercial: CommercialRequirements): { status:CatalogEligibility; reasons:string[] } {
  const missing = Object.entries(commercial).filter(([,value]) => !value).map(([key]) => `commercial:${key}`);
  if (taxonomy.universe === "NON_SNEAKER") return { status:"OUT_OF_SCOPE_CONFIRMED", reasons:["taxonomy:non_sneaker",...missing] };
  if (missing.length || taxonomy.universe === "UNRESOLVED" || taxonomy.reasons.includes("CONFLICTING_SIGNALS")) return { status:"REVIEW_REQUIRED", reasons:missing.length ? missing : [taxonomy.universe === "UNRESOLVED" ? "taxonomy:unresolved" : "taxonomy:conflicting_signals"] };
  return { status:taxonomy.universe === "SNEAKER_CONFIRMED" ? "IN_SCOPE_CONFIRMED" : "IN_SCOPE_PROBABLE", reasons:["minimum_requirements_met"] };
}

export type SizeAssessment = { suspicious:boolean; reason:"SIZE_STANDARD"|"SIZE_CHILD_NUMERIC_PLAUSIBLE"|"SIZE_FRACTIONAL_PLAUSIBLE"|"SIZE_UNIQUE_REVIEW"|"SIZE_APPAREL_SIGNAL"|"SIZE_OUTLIER_REVIEW"|"SIZE_MISSING" };
export function assessSize(value: unknown, audience?: unknown): SizeAssessment {
  const raw=String(value??"").trim(), normalized=fold(raw);
  if (!raw) return {suspicious:true,reason:"SIZE_MISSING"};
  if (/^\d{2}$/.test(raw)) { const n=Number(raw); if(n>=15&&n<=55)return {suspicious:false,reason:"SIZE_STANDARD"}; if(n>=8&&n<=14&&/infantil|kids?|crianca|menino|menina|bebe|baby/.test(fold(audience)))return {suspicious:false,reason:"SIZE_CHILD_NUMERIC_PLAUSIBLE"}; return {suspicious:true,reason:"SIZE_OUTLIER_REVIEW"}; }
  if (/^\d{2}(?:[.,]5|\s+1\/2)$/.test(raw)) return {suspicious:false,reason:"SIZE_FRACTIONAL_PLAUSIBLE"};
  if (/^(unico|unico \(\d+\)|único)$/i.test(raw)) return {suspicious:true,reason:"SIZE_UNIQUE_REVIEW"};
  if (/^(p|m|g|gg|eg)$/i.test(normalized)) return {suspicious:true,reason:"SIZE_APPAREL_SIGNAL"};
  if (/^\d{2}(?:[.,]5)?\s*[-/]\s*\d{2}(?:[.,]5)?$/.test(raw)) return {suspicious:false,reason:"SIZE_STANDARD"};
  return {suspicious:true,reason:"SIZE_OUTLIER_REVIEW"};
}
