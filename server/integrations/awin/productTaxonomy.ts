export type ProductUniverse = "SNEAKER_CONFIRMED" | "SNEAKER_PROBABLE" | "NON_SNEAKER" | "UNRESOLVED";
export type ProductStyle = "PERFORMANCE" | "SPORTSWEAR" | "LIFESTYLE" | "HYBRID" | "UNKNOWN";
export type ProductActivity = "RUNNING" | "WALKING" | "TRAINING" | "FOOTBALL" | "FUTSAL" | "BASKETBALL" | "TENNIS_COURT" | "VOLLEYBALL" | "SKATE" | "TRAIL" | "OTHER_SPORT" | "GENERAL" | "UNKNOWN";
export type TaxonomyConfidence = "HIGH" | "MEDIUM" | "LOW";
export type TaxonomyReason =
  | "CATEGORY_EXPLICIT_SNEAKER" | "CATEGORY_GENERIC_FOOTWEAR" | "NAME_SNEAKER_SIGNAL"
  | "STRUCTURED_ATTRIBUTE_SIGNAL" | "CATEGORY_ACTIVITY_SIGNAL" | "NAME_ACTIVITY_SIGNAL"
  | "DESCRIPTION_ACTIVITY_SIGNAL" | "NEGATIVE_FOOTWEAR_SIGNAL" | "CONFLICTING_SIGNALS"
  | "NEGATIVE_NON_SNEAKER_SIGNAL"
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
const sneaker = /\b(tenis|sneakers?|sapatenis)\b/;
const genericFootwear = /\b(calcados?|footwear)\b/;
const negative = /\b(sandalias?|chinelos?|rasteiras?|sapatilhas?|scarpins?|botas?|mocassins?|oxfords?|sapatos? social|papetes?)\b/;
const negativeProduct = /\b(mochilas?|camisetas?|camisas?|calcoes?|shorts?|bolsas?|meias?|bones?|acessorios?|conjuntos?)\b/;

const activityRules: Array<[Exclude<ProductActivity,"GENERAL"|"UNKNOWN">, RegExp]> = [
  ["FUTSAL", /\bfutsal\b/], ["FOOTBALL", /\b(futebol|football|chuteira|society|campo)\b/],
  ["BASKETBALL", /\b(basquete|basketball)\b/], ["TENNIS_COURT", /\b(tennis court|tenis de quadra|court tennis)\b/],
  ["VOLLEYBALL", /\b(volei|voleibol|volleyball)\b/], ["TRAIL", /\b(trail|trilha)\b/],
  ["RUNNING", /\b(corrida|running|runner|jogging)\b/], ["WALKING", /\b(caminhada|walking)\b/],
  ["TRAINING", /\b(treino|training|academia|crossfit|fitness)\b/], ["SKATE", /\b(skate|sk8)\b/],
  ["OTHER_SPORT", /\b(esportivo|sport)\b/],
];

function signals(text: string) { return activityRules.filter(([, rule]) => has(text, rule)).map(([activity]) => activity); }
function unique<T>(items: T[]): T[] { return Array.from(new Set(items)); }

export function classifyProductTaxonomy(input: ProductTaxonomyInput): ProductTaxonomyResult {
  const category = fold([input.merchantCategory,input.categoryPath,input.secondCategory,input.thirdCategory,input.productType,input.fashionCategory].join(" "));
  const attributes = fold(typeof input.attributes === "string" ? input.attributes : JSON.stringify(input.attributes ?? {}));
  const name = fold(input.name), description = fold(input.description);
  const categorySneaker = has(category, sneaker), attributeSneaker = has(attributes, sneaker), nameSneaker = has(name, sneaker);
  const categoryNegative = has(category, negative), nameNegative = has(name, negative), nameNonSneaker = has(name, negativeProduct);
  const reasons: TaxonomyReason[] = [], evidence: string[] = [];
  if (categorySneaker) { reasons.push("CATEGORY_EXPLICIT_SNEAKER"); evidence.push("category:sneaker"); }
  if (attributeSneaker) { reasons.push("STRUCTURED_ATTRIBUTE_SIGNAL"); evidence.push("attribute:sneaker"); }
  if (nameSneaker) { reasons.push("NAME_SNEAKER_SIGNAL"); evidence.push("name:sneaker"); }
  if (has(category, genericFootwear)) { reasons.push("CATEGORY_GENERIC_FOOTWEAR"); evidence.push("category:footwear"); }
  if (categoryNegative || nameNegative) { reasons.push("NEGATIVE_FOOTWEAR_SIGNAL"); evidence.push(categoryNegative ? "category:negative_footwear" : "name:negative_footwear"); }
  if (nameNonSneaker) { reasons.push("NEGATIVE_NON_SNEAKER_SIGNAL"); evidence.push("name:negative_non_sneaker"); }

  let universe: ProductUniverse, confidence: TaxonomyConfidence;
  const positive = categorySneaker || attributeSneaker || nameSneaker;
  if ((nameNegative || nameNonSneaker) && !nameSneaker) {
    universe = "NON_SNEAKER"; confidence = "HIGH";
  } else if ((categoryNegative || nameNegative || nameNonSneaker) && positive) {
    universe = "SNEAKER_PROBABLE"; confidence = "LOW"; reasons.push("CONFLICTING_SIGNALS");
  } else if (categorySneaker && (nameSneaker || attributeSneaker)) {
    universe = "SNEAKER_CONFIRMED"; confidence = "HIGH";
  } else if (categorySneaker || attributeSneaker) {
    universe = "SNEAKER_CONFIRMED"; confidence = "HIGH";
  } else if (nameSneaker) {
    universe = "SNEAKER_PROBABLE"; confidence = "MEDIUM";
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
