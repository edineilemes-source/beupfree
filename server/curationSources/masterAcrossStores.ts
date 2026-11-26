/**
 * Read-only verification of cross-store Product Master assignments.
 * Uses historical readMaster() freshness/coverage rules. GTIN candidate pairs
 * never turn into automatic Master merges.
 */
import {readMaster} from "../productIdentity/reader";
type DB={query(sql:string,params?:unknown[]):Promise<{rows:any[]}>};
export type ComparedOffer={
 productId:string;name:string;merchant:string;price:number;previousPrice:number|null;
 discountPercent:number;priceStatus:"REGULAR_PRICE"|"PROMOTION_CONFIRMED";url:string;
};
export type ConfirmedComparison={masterId:string;label:string;brand:string|null;offers:ComparedOffer[]};
export type GtinReview={gtin:string;offers:ComparedOffer[];reason:"SAME_GTIN_REVIEW_REQUIRED"};
function safeOffer(row:any):ComparedOffer|null{
 const price=Number(row.current_price),prior=Number(row.previous_price),discount=Number(row.discount_percent);
 const kind=String(row.promotion_status|| (discount>0?"PROMOTION_CONFIRMED":"REGULAR_PRICE"));
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(discount)||
    !["REGULAR_PRICE","PROMOTION_CONFIRMED"].includes(kind))return null;
 if(kind==="REGULAR_PRICE"&&discount!==0)return null;
 if(kind==="PROMOTION_CONFIRMED"&&
    (!Number.isFinite(prior)||prior<=price||discount<=0||discount>100))return null;
 let url:string;
 try{url=new URL(row.affiliate_url).toString();
  if(!/^https?:$/.test(new URL(url).protocol))return null;
 }catch{return null}
 if(typeof row.merchant_name!=="string"||!row.merchant_name.trim()||
    typeof row.product_name!=="string"||!row.product_name.trim()||
    typeof row.product_id!=="string")return null;
 return {productId:row.product_id,name:row.product_name,merchant:row.merchant_name,
   price,previousPrice:kind==="PROMOTION_CONFIRMED"?prior:null,
   discountPercent:discount,priceStatus:kind as ComparedOffer["priceStatus"],url};
}
function byDistinctMerchant(items:ComparedOffer[]):ComparedOffer[]{
 const map=new Map<string,ComparedOffer>();
 for(const item of [...items].sort((x,y)=>x.price-y.price||x.merchant.localeCompare(y.merchant)))
  if(!map.has(item.merchant))map.set(item.merchant,item);
 return [...map.values()];
}
export async function verifyCrossStoreMaster(db:DB,limit=8){
 if(!Number.isSafeInteger(limit)||limit<1||limit>20)throw Error("CROSS_STORE_LIMIT_INVALID");
 const summary=await db.query([
  "SELECT count(*)::int total FROM (",
  "SELECT m.master_product_id FROM product_master_memberships m",
  "JOIN external_product_identities e ON e.id=m.external_product_identity_id",
  "WHERE m.valid_to IS NULL",
  "GROUP BY m.master_product_id HAVING count(DISTINCT e.merchant_id)>=2",
  ") grouped"].join(" "));
 const masterGroups=Number(summary.rows[0]?.total??0);
 const source=await db.query([
  "SELECT m.master_product_id, min(e.product_id) product_id",
  "FROM product_master_memberships m",
  "JOIN external_product_identities e ON e.id=m.external_product_identity_id",
  "WHERE m.valid_to IS NULL",
  "GROUP BY m.master_product_id HAVING count(DISTINCT e.merchant_id)>=2",
  "ORDER BY m.master_product_id LIMIT $1"].join(" "),[Math.max(limit*8,40)]);
 const confirmed:ConfirmedComparison[]=[];
 let checked=0;
 for(const candidate of source.rows){
  checked++;
  // Respect the original freshness and complete-group gates.
  const original=await readMaster(db as any,String(candidate.product_id));
  if(!original?.master||!Array.isArray(original.offers))continue;
  const offers=byDistinctMerchant(original.offers.map(safeOffer).filter((x):x is ComparedOffer=>x!==null));
  if(offers.length<2)continue;
  confirmed.push({masterId:String(original.master.id),
    label:String(original.master.canonicalName||offers[0].name),
    brand:original.master.brand,offers});
  if(confirmed.length>=limit)break;
 }
 // Valid GTIN overlap is a candidate, NEVER proof of a verified Master group.
 const gtins=await db.query([
  "SELECT v.gtin FROM product_variants v",
  "JOIN catalog_search_products c ON c.product_id=v.product_id",
  "AND c.merchant_id=v.merchant_id AND c.provider_id=v.provider_id",
  "WHERE v.gtin ~ '^[0-9]{8,14}$' AND c.available=true",
  "AND c.catalog_state='CATALOG_ELIGIBLE' AND c.universe='SNEAKER_CONFIRMED'",
  "GROUP BY v.gtin HAVING count(DISTINCT v.merchant_id)>=2",
  "ORDER BY count(DISTINCT v.merchant_id) DESC,v.gtin LIMIT $1"].join(" "),[limit*2]);
 const review:GtinReview[]=[];
 for(const row of gtins.rows){
  const items=await db.query([
   "SELECT DISTINCT ON (c.merchant_id) c.product_id,c.product_name,",
   "c.current_price,c.previous_price,c.discount_percent,c.promotion_status,",
   "m.name merchant_name,o.affiliate_url",
   "FROM product_variants v",
   "JOIN catalog_search_products c ON c.product_id=v.product_id",
   "AND c.merchant_id=v.merchant_id AND c.provider_id=v.provider_id",
   "JOIN commerce_merchants m ON m.id=c.merchant_id",
   "JOIN offers o ON o.id=c.representative_offer_id",
   "AND o.product_id=c.product_id AND o.merchant_id=c.merchant_id",
   "WHERE v.gtin=$1 AND c.catalog_state='CATALOG_ELIGIBLE'",
   "AND c.available=true AND c.universe='SNEAKER_CONFIRMED'",
   "ORDER BY c.merchant_id,c.current_price"].join(" "),[row.gtin]);
  const offers=byDistinctMerchant(items.rows.map(safeOffer).filter((x):x is ComparedOffer=>x!==null));
  if(offers.length<2)continue;
  review.push({gtin:String(row.gtin),offers,reason:"SAME_GTIN_REVIEW_REQUIRED"});
  if(review.length>=limit)break;
 }
 return {
  mode:"READ_ONLY" as const,
  masterGroupsWithMultipleMerchants:masterGroups,
  inspectedMasterGroups:checked,
  inspectionComplete:checked===masterGroups,
  confirmed,
  gtinCandidates:review,
  gtinCandidatesComplete:gtins.rows.length<limit*2,
  note:"Master confirmado somente com grupo vigente completo e ofertas elegíveis de ao menos duas lojas. GTIN repetido requer revisão; nenhuma fusão é executada.",
  publication:false,changes:0
 };
}
