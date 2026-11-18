import type {NormalizedAwinItem} from "./types";
import {assessAwinCatalogCandidate} from "./catalogCandidate";

/** Fully source-qualified commercial evidence; no DB writes or automatic publication. */
export type CatalogPriceEvidence = {
 offerKey:string;merchantId:string;feedId:string;
 status:"PROMOTION_CONFIRMED"|"REGULAR_PRICE"|"REVIEW_REQUIRED";
 currentPrice:number;rawPreviousPrice:number|null;
 compatibilityPreviousPrice:number|null;discountPercent:number;
 evidenceType:"AWIN_FEED_DISCOUNT"|"AWIN_FEED_CURRENT_ONLY"|"REQUIRES_REVIEW";
 reasonCodes:string[];
};
export function createCatalogPriceEvidence(item:NormalizedAwinItem):CatalogPriceEvidence {
 const assessed=assessAwinCatalogCandidate(item);
 const status=assessed.price.status;
 const currentPrice=item.offer.currentPrice;
 return {
  offerKey:item.offerKey,merchantId:item.provenance.merchantId,
  feedId:item.provenance.feedId,status,currentPrice,
  rawPreviousPrice:assessed.price.previousPrice,
  compatibilityPreviousPrice:status==="REGULAR_PRICE"?currentPrice:
   status==="PROMOTION_CONFIRMED"?assessed.price.previousPrice:null,
  discountPercent:assessed.price.discountPercent,
  evidenceType:status==="REGULAR_PRICE"?"AWIN_FEED_CURRENT_ONLY":status==="PROMOTION_CONFIRMED"?"AWIN_FEED_DISCOUNT":"REQUIRES_REVIEW",
  reasonCodes:assessed.price.reasonCodes
 };
}
