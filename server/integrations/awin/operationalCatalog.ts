import type { Audience } from "./dafitiCuration";
import type { CatalogEligibility, ProductActivity, ProductStyle, ProductUniverse, TaxonomyConfidence } from "./productTaxonomy";

export const CATALOG_CLASSIFIER_VERSION = "uppulse-taxonomy-v1";
export const CATALOG_NORMALIZER_VERSION = "uppulse-normalizer-v1";
export type CatalogOperationalState = "CATALOG_ELIGIBLE"|"QUARANTINED"|"OUT_OF_SCOPE"|"PUBLISHED"|"PAUSED";
export type NormalizationStatus = "NORMALIZED_SAFE"|"RAW_ONLY"|"SUSPICIOUS";

export function mapEligibilityToOperationalState(status:CatalogEligibility):CatalogOperationalState {
  if(status==="IN_SCOPE_CONFIRMED")return "CATALOG_ELIGIBLE";
  if(status==="OUT_OF_SCOPE_CONFIRMED")return "OUT_OF_SCOPE";
  return "QUARANTINED";
}

export type SizeNormalization={raw:string|null;normalized:number|null;status:NormalizationStatus;reasonCode:string};
export function normalizeCatalogSize(value:unknown,audience:Audience|"UNKNOWN"="UNKNOWN"):SizeNormalization{
 const raw=String(value??"").trim();if(!raw)return {raw:null,normalized:null,status:"SUSPICIOUS",reasonCode:"SIZE_MISSING"};
 const fractional=raw.match(/^(\d{2})\s+1\/2$/);if(fractional)return {raw,normalized:Number(fractional[1])+.5,status:"NORMALIZED_SAFE",reasonCode:"SIZE_FRACTION_HALF"};
 if(/^\d{2}[.,]5$/.test(raw)){const normalized=Number(raw.replace(",","."));return normalized>=15&&normalized<=55?{raw,normalized,status:"NORMALIZED_SAFE",reasonCode:"SIZE_DECIMAL"}:{raw,normalized:null,status:"SUSPICIOUS",reasonCode:"SIZE_NUMERIC_OUTLIER"};}
 if(/^\d{2}$/.test(raw)){const normalized=Number(raw);if(normalized>=15&&normalized<=55)return {raw,normalized,status:"NORMALIZED_SAFE",reasonCode:"SIZE_BR_NUMERIC"};if(normalized>=8&&normalized<=14&&audience==="INFANTIL")return {raw,normalized,status:"NORMALIZED_SAFE",reasonCode:"SIZE_CHILD_CONTEXT"};return {raw,normalized:null,status:"SUSPICIOUS",reasonCode:"SIZE_NUMERIC_OUTLIER"};}
 if(/^(p|m|g|gg|eg)$/i.test(raw))return {raw,normalized:null,status:"SUSPICIOUS",reasonCode:"SIZE_APPAREL_SIGNAL"};
 if(/^(unico|único)(?:\s*\(\d+\))?$/i.test(raw))return {raw,normalized:null,status:"RAW_ONLY",reasonCode:"SIZE_UNIQUE_RAW_ONLY"};
 return {raw,normalized:null,status:"RAW_ONLY",reasonCode:"SIZE_UNMAPPED_RAW_ONLY"};
}

const knownColours=new Map<string,string>([
 ["preto","preto"],["branco","branco"],["bege","bege"],["cinza","cinza"],["marrom","marrom"],["azul","azul"],["azul marinho","azul marinho"],["rosa","rosa"],["verde","verde"],["vermelho","vermelho"],["roxo","roxo"],["laranja","laranja"],["nude","nude"],["caramelo","caramelo"],["prata","prata"],["cafe","café"],["grafite","grafite"],["dourado","dourado"],["amarelo","amarelo"],["off-white","off-white"],["multicolorido","multicolorido"],["vinho","vinho"],["pink","pink"],["bordo","bordô"],["lilas","lilás"],["caqui","cáqui"],["coral","coral"],["rose","rosê"],["verde militar","verde militar"],["incolor","incolor"]
]);
const fold=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
export type ColourNormalization={raw:string|null;normalized:string[]|null;status:NormalizationStatus;compound:boolean;reasonCode:string};
export function normalizeCatalogColour(value:unknown):ColourNormalization{
 const raw=String(value??"").trim();if(!raw)return {raw:null,normalized:null,status:"SUSPICIOUS",compound:false,reasonCode:"COLOUR_MISSING"};
 const parts=raw.split(/\s*[\/+,&]\s*/).filter(Boolean),compound=parts.length>1;
 const normalized=parts.map(part=>knownColours.get(fold(part))).filter((part):part is string=>Boolean(part));
 if(normalized.length===parts.length)return {raw,normalized:Array.from(new Set(normalized)),status:"NORMALIZED_SAFE",compound,reasonCode:compound?"COLOUR_COMPOUND_EXPLICIT":"COLOUR_KNOWN"};
 return {raw,normalized:null,status:"RAW_ONLY",compound,reasonCode:"COLOUR_UNMAPPED_RAW_ONLY"};
}

export function validatePromotion(input:{currentPrice:number;previousPrice:number;discountPercent:number;currency:string}):{valid:boolean;calculatedPercent:number|null;reasonCodes:string[]}{
 const reasons:string[]=[];if(!(input.currentPrice>0))reasons.push("PRICE_CURRENT_INVALID");if(!(input.previousPrice>input.currentPrice))reasons.push("PRICE_ORDER_INVALID");if(input.currency!=="BRL")reasons.push("CURRENCY_NOT_BRL");
 const calculated=input.previousPrice>0?+(((input.previousPrice-input.currentPrice)/input.previousPrice)*100).toFixed(3):null;if(calculated==null||Math.abs(calculated-input.discountPercent)>.11)reasons.push("DISCOUNT_MATH_INCONSISTENT");
 return {valid:reasons.length===0,calculatedPercent:calculated,reasonCodes:reasons};
}
export function auditAffiliateUrl(value:unknown):{literal:string|null;valid:boolean;host:string|null;reasonCode:string}{
 const literal=typeof value==="string"?value:null;if(!literal)return {literal:null,valid:false,host:null,reasonCode:"AFFILIATE_URL_MISSING"};try{const url=new URL(literal);return {literal,valid:/^https?:$/.test(url.protocol),host:url.hostname,reasonCode:/^https?:$/.test(url.protocol)?"AFFILIATE_URL_LITERAL_VALID":"AFFILIATE_URL_PROTOCOL_INVALID"};}catch{return {literal,valid:false,host:null,reasonCode:"AFFILIATE_URL_INVALID"};}
}

export interface OperationalTaxonomy{universe:ProductUniverse;style:ProductStyle;activities:ProductActivity[];confidence:TaxonomyConfidence;reasonCodes:string[];classifierVersion:string;}
export interface OperationalCatalogVariant{id:string;merchantVariationIdentity:string;sizeRaw:string|null;sizeNormalized:number|null;sizeStatus:NormalizationStatus;colorRaw:string|null;colorNormalized:string[]|null;colorStatus:NormalizationStatus;available:boolean;}
export interface OperationalCatalogProduct{
 id:string;brand:string;name:string;description:string|null;audience:Audience;catalogStatus:CatalogOperationalState;
 taxonomy:OperationalTaxonomy;pricing:{currentPrice:number;previousPrice:number;discountPercent:number;merchantDiscountPercent:number;currency:string;promotionEvidence:string};
 variants:OperationalCatalogVariant[];images:Array<{url:string;position:number;primary:boolean}>;
 merchant:{id:string;name:string;provider:string};affiliateUrl:string;merchantUrl:string|null;
 sorting:{price:true;discount:true;brand:true;activity:true;merchant:true;relevance:false;popularity:false};
}

export function latestClassification<T extends {classifiedAt:Date;createdAt?:Date}>(rows:T[]):T|null{return rows.slice().sort((a,b)=>{const classified=b.classifiedAt.getTime()-a.classifiedAt.getTime();return classified||((b.createdAt?.getTime()??0)-(a.createdAt?.getTime()??0));})[0]??null;}

export type PreparedCatalogProduct={id:string;state:CatalogOperationalState;validOffers:number;images:number;affiliateUrls:number;variants:number;published:boolean;activeVariant:boolean;activeOffer:boolean};
export function assertOperationalCatalogInvariants(products:PreparedCatalogProduct[],expectedTotal=11854,expected={CATALOG_ELIGIBLE:11424,QUARANTINED:192,OUT_OF_SCOPE:238}):void{
 if(products.length!==expectedTotal)throw new Error(`INVARIANT_TOTAL:${products.length}:${expectedTotal}`);
 const counts={CATALOG_ELIGIBLE:0,QUARANTINED:0,OUT_OF_SCOPE:0};for(const product of products){if(product.state in counts)counts[product.state as keyof typeof counts]++;if(product.state==="CATALOG_ELIGIBLE"&&(product.validOffers<1||product.images<1||product.affiliateUrls<1||product.variants<1))throw new Error(`INVARIANT_ELIGIBLE_MINIMUM:${product.id}`);if(product.published||product.activeVariant||product.activeOffer)throw new Error(`INVARIANT_DAFITI_VISIBILITY:${product.id}`);}
 if(counts.CATALOG_ELIGIBLE!==expected.CATALOG_ELIGIBLE||counts.QUARANTINED!==expected.QUARANTINED||counts.OUT_OF_SCOPE!==expected.OUT_OF_SCOPE)throw new Error(`INVARIANT_EDITORIAL_CLOSURE:${JSON.stringify(counts)}`);
}
