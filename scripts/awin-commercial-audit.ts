/**
 * Audita preço regular, taxonomia e requisitos de publicação SEM banco e sem exportar URLs ou segredos.
 *
 * Uso: node --import tsx scripts/awin-commercial-audit.ts --file /path/feed.csv.gz --merchant 17698 --feed-id 51837
 * Para qualquer anunciante AWIN, os IDs são parâmetros; não há heurísticas por marca.
 */
import {resolve} from "node:path";
import {openGzipFile} from "../server/integrations/awin/input";
import {parseAwinCsv} from "../server/integrations/awin/csv";
import {normalizeAwinItem,isInvalidAwinItem} from "../server/integrations/awin/normalize";
import {classifyProductTaxonomy,classifyCatalogEligibility} from "../server/integrations/awin/productTaxonomy";
import {evaluateCommercialPrice,auditAffiliateUrl} from "../server/integrations/awin/operationalCatalog";

const args=process.argv.slice(2);
const arg=(flag:string)=>{const found=args.find(x=>x.startsWith(flag+"="));if(found)return found.slice(flag.length+1);const i=args.indexOf(flag);return i>=0?args[i+1]:undefined};
const file=arg("--file"),merchant=arg("--merchant"),feedId=arg("--feed-id");
if(!file||!merchant||!feedId||!/^[0-9]+$/.test(merchant)||!/^[0-9]+$/.test(feedId))throw new Error("USAGE: --file PATH --merchant ID --feed-id ID");
const bump=(c:Record<string,number>,key:string)=>c[key]=(c[key]??0)+1;
const totals={rows:0,validRaw:0,invalidRaw:0,merchantMismatch:0,feedMismatch:0,taxonomy:{} as Record<string,number>,priceStates:{} as Record<string,number>,eligibility:{} as Record<string,number>,reasons:{} as Record<string,number>,sizePresent:0,gtinValid:0};
const keys=new Set<string>(),variants=new Set<string>();
for await(const row of parseAwinCsv(openGzipFile(resolve(file)))){
 totals.rows++;
 if(row.raw.merchant_id!==merchant){totals.merchantMismatch++;continue;}
 if(row.raw.data_feed_id&&row.raw.data_feed_id!==feedId){totals.feedMismatch++;continue;}
 const item=normalizeAwinItem(row,{feedId});
 if(isInvalidAwinItem(item)){totals.invalidRaw++;for(const reason of item.reasons)bump(totals.reasons,"RAW_"+reason);continue;}
 totals.validRaw++;keys.add(item.productKey);variants.add(item.variantKey);
 if(item.variant.size)totals.sizePresent++;
 if(item.variant.validGtin)totals.gtinValid++;
 const taxonomy=classifyProductTaxonomy({
  merchantCategory:item.product.category.merchantCategory,
  categoryPath:item.product.category.path,secondCategory:item.product.category.second,
  thirdCategory:item.product.category.third,productType:item.product.productType,
  name:item.product.name,description:item.product.description,brand:item.product.brand,
  attributes:row.raw
 });
 const price=evaluateCommercialPrice({
  currentPrice:item.offer.currentPrice,previousPrice:item.offer.prices.old,
  discountPercent:item.offer.prices.savingsPercent,currency:item.offer.currency
 });
 bump(totals.taxonomy,taxonomy.universe);bump(totals.priceStates,price.status);
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
  identitySufficient:Boolean(item.product.identifiers.awProductId||item.product.identifiers.merchantProductId)
 };
 const classified=classifyCatalogEligibility(taxonomy,commercial);
 bump(totals.eligibility,classified.status);
 for(const reason of classified.reasons)if(reason!=="minimum_requirements_met")bump(totals.reasons,reason);
}
if(totals.merchantMismatch||totals.feedMismatch){throw new Error("SOURCE_ID_MISMATCH: inspect totals locally; no data imported");}
console.log(JSON.stringify({merchant,feedId,totals:{...totals,uniqueProductKeys:keys.size,uniqueVariantKeys:variants.size},mode:"READ_ONLY_DRY_RUN",writes:0},null,2));
