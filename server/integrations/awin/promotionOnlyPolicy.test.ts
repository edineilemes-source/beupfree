import assert from "node:assert/strict";
import test from "node:test";
import {isPersistablePromotion,promotionOnlyState,type PromotionOnlyCandidate} from "./promotionOnlyPolicy";

const candidate=(universe:string,eligibility:string,price:string):PromotionOnlyCandidate=>({
 taxonomy:{universe},eligibility:{status:eligibility},price:{status:price}
});

test("promotional-only policy rejects regular-only product and uncertain taxonomy",()=>{
 assert.equal(promotionOnlyState([candidate("SNEAKER_CONFIRMED","IN_SCOPE_CONFIRMED","REGULAR_PRICE")]),"QUARANTINED");
 assert.equal(promotionOnlyState([candidate("SNEAKER_PROBABLE","IN_SCOPE_CONFIRMED","PROMOTION_CONFIRMED")]),"QUARANTINED");
 assert.equal(promotionOnlyState([]),"QUARANTINED");
});
test("promotional-only policy requires valid confirmed promotion",()=>{
 assert.equal(promotionOnlyState([candidate("SNEAKER_CONFIRMED","IN_SCOPE_CONFIRMED","PROMOTION_CONFIRMED")]),"CATALOG_ELIGIBLE");
 assert.equal(promotionOnlyState([candidate("SNEAKER_CONFIRMED","REVIEW_REQUIRED","PROMOTION_CONFIRMED")]),"QUARANTINED");
 assert.equal(promotionOnlyState([candidate("SNEAKER_CONFIRMED","IN_SCOPE_CONFIRMED","REGULAR_PRICE"),candidate("SNEAKER_CONFIRMED","IN_SCOPE_CONFIRMED","PROMOTION_CONFIRMED")]),"CATALOG_ELIGIBLE");
});
test("non-sneaker in any variant keeps product out of catalog",()=>{
 assert.equal(promotionOnlyState([candidate("SNEAKER_CONFIRMED","IN_SCOPE_CONFIRMED","PROMOTION_CONFIRMED"),candidate("NON_SNEAKER","OUT_OF_SCOPE_CONFIRMED","REGULAR_PRICE")]),"OUT_OF_SCOPE");
});
test("evidence persistence requires strictly positive verified discount",()=>{
 assert.equal(isPersistablePromotion({status:"PROMOTION_CONFIRMED",currentPrice:200,compatibilityPreviousPrice:300,discountPercent:33.333}),true);
 assert.equal(isPersistablePromotion({status:"REGULAR_PRICE",currentPrice:200,compatibilityPreviousPrice:200,discountPercent:0}),false);
 assert.equal(isPersistablePromotion({status:"PROMOTION_CONFIRMED",currentPrice:200,compatibilityPreviousPrice:200,discountPercent:10}),false);
 assert.equal(isPersistablePromotion({status:"REVIEW_REQUIRED",currentPrice:200,compatibilityPreviousPrice:300,discountPercent:33}),false);
});
