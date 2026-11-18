/**
 * Classification shared by AWIN feed audit and future staged catalog promotion.
 * Pure/read-only: no DB operations, no advertiser-specific exceptions.
 */
import type {NormalizedAwinItem} from "./types";
import {classifyProductTaxonomy,classifyCatalogEligibility} from "./productTaxonomy";
import {auditAffiliateUrl,evaluateCommercialPrice} from "./operationalCatalog";

export function assessAwinCatalogCandidate(item:NormalizedAwinItem){
 const taxonomy=classifyProductTaxonomy({
  merchantCategory:item.product.category.merchantCategory,
  categoryPath:item.product.category.path,
  secondCategory:item.product.category.second,
  thirdCategory:item.product.category.third,
  productType:item.product.productType,
  name:item.product.name,
  description:item.product.description,
  brand:item.product.brand,
  attributes:item.raw.payload,
 });
 const price=evaluateCommercialPrice({
  currentPrice:item.offer.currentPrice,
  // Missing old price must remain missing, not be synthesized from RRP.
  previousPrice:item.offer.prices.old,
  discountPercent:item.offer.prices.savingsPercent,
  currency:item.offer.currency,
 });
 const commercial={
  priceState:price.status,
  promotionConfirmed:price.status==="PROMOTION_CONFIRMED",
  validCurrentPrice:price.status!=="REVIEW_REQUIRED",
  validOldPrice:price.status==="PROMOTION_CONFIRMED",
  discountConsistent:price.status==="PROMOTION_CONFIRMED",
  imageAvailable:item.images.some(url=>/^https?:\/\//.test(url)),
  brandAvailable:Boolean(item.product.brand?.trim()),
  affiliateAvailable:auditAffiliateUrl(item.offer.affiliateUrl).valid,
  inStock:item.offer.availability.inStock===true,
  identitySufficient:Boolean(item.productKey&&item.variantKey&&item.offerKey&&(item.product.identifiers.awProductId||item.product.identifiers.merchantProductId)),
 };
 const eligibility=classifyCatalogEligibility(taxonomy,commercial);
 return {taxonomy,price,commercial,eligibility};
}
