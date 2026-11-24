/** Product-level commercial gate for legacy promotional-only catalog constraints. */
export type PromotionOnlyCandidate={taxonomy:{universe:string};eligibility:{status:string};price:{status:string}};
export function promotionOnlyState(rows:PromotionOnlyCandidate[]):"OUT_OF_SCOPE"|"CATALOG_ELIGIBLE"|"QUARANTINED"{
 if(rows.length===0)return "QUARANTINED";
 if(rows.some(row=>row.taxonomy.universe==="NON_SNEAKER"))return "OUT_OF_SCOPE";
 // Every variant must be taxonomically confirmed; a regular-price variant
 // may remain staged, while at least one independently verified promotion
 // is required to put the product in the search projection.
 if(rows.some(row=>row.taxonomy.universe!=="SNEAKER_CONFIRMED"))return "QUARANTINED";
 return rows.some(row=>row.price.status==="PROMOTION_CONFIRMED"&&row.eligibility.status==="IN_SCOPE_CONFIRMED")
  ?"CATALOG_ELIGIBLE":"QUARANTINED";
}
export function isPersistablePromotion(input:{status:string;compatibilityPreviousPrice:number|null;currentPrice:number;discountPercent:number}):boolean{
 return input.status==="PROMOTION_CONFIRMED"&&
  typeof input.compatibilityPreviousPrice==="number"&&
  Number.isFinite(input.compatibilityPreviousPrice)&&
  Number.isFinite(input.currentPrice)&&
  input.currentPrice>0&&input.compatibilityPreviousPrice>input.currentPrice&&
  input.discountPercent>0&&input.discountPercent<=100;
}
