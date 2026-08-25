export const DAFITI_MERCHANT_ID = "17697";

export type ProductScope = "RUNNING"|"TRAINING"|"WALKING"|"PERFORMANCE_OTHER"|"SPORTSWEAR"|"LIFESTYLE"|"SKATE"|"FOOTBALL"|"FUTSAL"|"BASKETBALL"|"TENNIS_COURT"|"OTHER_SPORT"|"UNCERTAIN"|"EXCLUDED_NON_SNEAKER";
export type Audience = "MASCULINO"|"FEMININO"|"UNISSEX"|"INFANTIL"|"UNKNOWN";
export type CurationStatus = "ELIGIBLE"|"NEEDS_REVIEW"|"INELIGIBLE";
export type ScopeResult = { scope: ProductScope; confidence: "high"|"medium"|"low"; evidence: string[] };

const fold = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const token = (text: string, pattern: RegExp) => pattern.test(` ${text} `);

export function classifyDafitiScope(input: Record<string, unknown>): ScopeResult {
  const structured = fold([input.merchantCategory,input.categoryPath,input.secondCategory,input.thirdCategory,input.productType,input.fashionCategory].join(" "));
  const name = fold(input.name), description = fold(input.description);
  const sneakerStructured = token(structured, /\b(tenis|sneaker)\b/);
  const sneakerName = token(name, /\b(tenis|sneaker)\b/);
  if (!sneakerStructured && !sneakerName) return { scope:"EXCLUDED_NON_SNEAKER",confidence:"high",evidence:["no_sneaker_signal"] };
  const evidence = sneakerStructured ? ["structured:sneaker"] : ["name:sneaker"];
  const combined = `${structured} ${name}`;
  const rules: Array<[ProductScope,RegExp,string]> = [
    ["FUTSAL",/\bfutsal\b/,"futsal"],["FOOTBALL",/\b(futebol|chuteira|society|campo)\b/,"football"],
    ["BASKETBALL",/\b(basquete|basketball)\b/,"basketball"],["TENNIS_COURT",/\b(tennis court|tenis de quadra)\b/,"tennis_court"],
    ["RUNNING",/\b(corrida|running|run |runner|jogging)\b/,"running"],["TRAINING",/\b(treino|training|academia|crossfit)\b/,"training"],
    ["WALKING",/\b(caminhada|walking)\b/,"walking"],["SKATE",/\b(skate|sk8)\b/,"skate"],
    ["SPORTSWEAR",/\b(sportswear|sportwear)\b/,"sportswear"],["LIFESTYLE",/\b(casual|lifestyle)\b/,"lifestyle"],
    ["PERFORMANCE_OTHER",/\bperformance\b/,"performance"],["OTHER_SPORT",/\b(esportivo|sport)\b/,"other_sport"],
  ];
  for (const [scope,re,label] of rules) if (re.test(combined)) return { scope,confidence:sneakerStructured?"high":"medium",evidence:[...evidence,`taxonomy_or_name:${label}`] };
  if (/\b(corrida|running|treino|academia|caminhada|skate|basquete)\b/.test(description)) return { scope:"UNCERTAIN",confidence:"low",evidence:[...evidence,"description:sport_signal"] };
  return { scope:"UNCERTAIN",confidence:sneakerStructured?"medium":"low",evidence };
}

export function classifyAudience(input: Record<string, unknown>): Audience {
  const structured=fold([input.suitableFor,input.gender,input.categoryPath].join(" ")), name=fold(input.name);
  if (/\b(infantil|kids?|crianca|menino|menina|baby|bebe)\b/.test(`${structured} ${name}`)) return "INFANTIL";
  if (/\b(unissex|unisex)\b/.test(structured)) return "UNISSEX";
  if (/\b(feminino|mulher|women|female)\b/.test(structured)) return "FEMININO";
  if (/\b(masculino|homem|men|male)\b/.test(structured)) return "MASCULINO";
  return "UNKNOWN";
}

export function suspiciousSize(value: unknown): boolean {
  const size=String(value??"").trim(); if(!size) return true;
  if (/^\d{2}(?:[.,]5)?$/.test(size)) { const n=Number(size.replace(",",".")); return n<15||n>55; }
  return !/^(?:\d{2}(?:[.,]5)?\s*[-/]\s*\d{2}(?:[.,]5)?|P|M|G|GG|UNICO|ÚNICO)$/i.test(size);
}

export type EligibilityInput = { scope: ScopeResult; currentPrice: number; oldPrice: number; discountPercent: number; inStock: boolean; affiliateAvailable: boolean; merchantUrlAvailable: boolean; imageAvailable: boolean; brand?: string|null; name?: string|null; size?: string|null; currency?: string|null; identityCollision?: boolean; extremeConsistent?: boolean };
export function curateVariant(input: EligibilityInput): { status:CurationStatus; reasons:string[] } {
  const bad:string[]=[];
  if(input.scope.scope==="EXCLUDED_NON_SNEAKER") bad.push("non_sneaker");
  if(!(input.oldPrice>input.currentPrice&&input.currentPrice>0)||Math.abs(input.discountPercent-((input.oldPrice-input.currentPrice)/input.oldPrice*100))>.11) bad.push("promotion_not_confirmed");
  if(!input.inStock) bad.push("out_of_stock"); if(!input.affiliateAvailable) bad.push("missing_affiliate_url"); if(!input.merchantUrlAvailable) bad.push("missing_merchant_url");
  if(!input.imageAvailable) bad.push("missing_image"); if(!input.brand?.trim()) bad.push("missing_brand"); if(!input.name?.trim()) bad.push("missing_title"); if(!input.size?.trim()) bad.push("missing_size"); if(input.currency!=="BRL") bad.push("non_brl");
  if(bad.length) return {status:"INELIGIBLE",reasons:bad};
  const review:string[]=[]; if(input.scope.scope==="UNCERTAIN") review.push("uncertain_scope"); if(suspiciousSize(input.size)) review.push("suspicious_size"); if(input.identityCollision) review.push("identity_warning"); if(input.discountPercent>=50&&!input.extremeConsistent) review.push("extreme_discount_inconsistent");
  return {status:review.length?"NEEDS_REVIEW":"ELIGIBLE",reasons:review.length?review:["eligible"]};
}

export function priceShape(offers:Array<{currentPrice:number;oldPrice:number;discountPercent:number}>) {
  const distinct=(key:keyof typeof offers[number])=>new Set(offers.map(o=>Number(o[key]).toFixed(3))).size;
  return { singlePrice:distinct("currentPrice")===1&&distinct("oldPrice")===1&&distinct("discountPercent")===1, multipleCurrentPrices:distinct("currentPrice")>1, multipleOldPrices:distinct("oldPrice")>1, multipleDiscounts:distinct("discountPercent")>1 };
}
