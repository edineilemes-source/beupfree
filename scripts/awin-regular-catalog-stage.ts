/** Multi-merchant AWIN staging; no publication, production, or other-merchant edits. */
import "dotenv/config";
import pg from "pg";
import {normalizeAwinItem,isInvalidAwinItem} from "../server/integrations/awin/normalize";
import {assessAwinCatalogCandidate} from "../server/integrations/awin/catalogCandidate";
import {createCatalogPriceEvidence} from "../server/integrations/awin/regularPriceEvidence";
import {classifyAudience} from "../server/integrations/awin/dafitiCuration";
import {CATALOG_CLASSIFIER_VERSION,CATALOG_NORMALIZER_VERSION,mapEligibilityToOperationalState,normalizeCatalogSize,normalizeCatalogColour} from "../server/integrations/awin/operationalCatalog";
import {persistClassifications,persistNormalizations,type ClassificationWrite,type NormalizationWrite} from "../server/integrations/awin/catalogPersistence";
const args=process.argv.slice(2),arg=(name:string)=>args.find(x=>x.startsWith(name+"="))?.slice(name.length+1);
const merchant=arg("--merchant")??"",feedId=arg("--feed-id")??"",expectedCount=Number(arg("--expected-raw-count"));
const commit=args.includes("--confirm-staging");
if(!/^\d+$/.test(merchant)||!/^\d+$/.test(feedId)||!Number.isSafeInteger(expectedCount)||expectedCount<1)throw Error("SOURCE_IDS_EXPECTED_COUNT_REQUIRED");
const urlText=process.env.AWIN_CATALOG_ADMIN_DATABASE_URL,expectedDb=process.env.AWIN_CATALOG_EXPECTED_DATABASE,expectedHost=process.env.AWIN_CATALOG_EXPECTED_HOST;
if(!urlText||!expectedDb||!expectedHost)throw Error("EXPLICIT_DATABASE_TARGET_REQUIRED");
const url=new URL(urlText);
if(url.hostname!==expectedHost||url.pathname.slice(1)!==expectedDb)throw Error("DATABASE_TARGET_MISMATCH");
const pool=new pg.Pool({connectionString:urlText,max:1});
const count=(values:string[])=>Object.fromEntries([...new Set(values)].sort().map(v=>[v,values.filter(w=>w===v).length]));
async function main(){
 const client=await pool.connect();const now=new Date().toISOString();
 try{
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ"+(commit?"":" READ ONLY"));
  const ident=(await client.query("SELECT current_database() db,current_user role")).rows[0];
  if(ident.db!==expectedDb||ident.role==="awin_curator")throw Error("DATABASE_IDENTITY_MISMATCH");
  const ms=(await client.query("SELECT id,provider_id FROM commerce_merchants WHERE external_merchant_id=$1",[merchant])).rows;
  if(ms.length!==1)throw Error("MERCHANT_NOT_FOUND");const m=ms[0];
  const fs=(await client.query("SELECT id FROM commerce_feeds WHERE merchant_id=$1 AND external_feed_id=$2",[m.id,feedId])).rows;
  if(fs.length!==1)throw Error("FEED_NOT_FOUND");const dbFeed=fs[0].id;
  const raw=(await client.query("SELECT id,raw_payload FROM commerce_raw_feed_items WHERE merchant_id=$1 AND feed_id=$2 ORDER BY id",[m.id,dbFeed])).rows;
  if(raw.length!==expectedCount)throw Error("RAW_COUNT_MISMATCH");
  const sql="SELECT r.id raw_id,v.id variant_id,v.product_id,o.id offer_id,o.current_price::float8 price,o.active offer_active,o.status offer_status,e.active identity_active,e.publication_state identity_state FROM commerce_raw_feed_items r JOIN product_variants v ON v.merchant_id=r.merchant_id AND v.merchant_product_id=r.merchant_product_id JOIN offers o ON o.variant_id=v.id AND o.merchant_id=r.merchant_id AND o.external_id=COALESCE(NULLIF(r.raw_payload->>'aw_product_id',''),NULLIF(r.raw_payload->>'merchant_product_id','')) JOIN external_product_identities e ON e.merchant_id=v.merchant_id AND e.product_id=v.product_id WHERE r.merchant_id=$1 AND r.feed_id=$2";
  const linked=(await client.query(sql,[m.id,dbFeed])).rows;
  const byRaw=new Map<string,any>();
  for(const r of linked){if(byRaw.has(r.raw_id))throw Error("AMBIGUOUS_JOIN");byRaw.set(r.raw_id,r);}
  if(byRaw.size!==raw.length)throw Error("INCOMPLETE_JOIN");
  if(linked.some(r=>r.offer_active||r.offer_status!=="paused"||r.identity_active||r.identity_state!=="staging"))throw Error("MERCHANT_NOT_ISOLATED");
  const groups=new Map<string,Array<{item:any;assessment:ReturnType<typeof assessAwinCatalogCandidate>}>>();
  const priceRows:Array<{offerId:string;status:string;price:number;old:number;percent:number;type:string}>=[];
  const normalizations:NormalizationWrite[]=[],seenVariants=new Set<string>(),seenOffers=new Set<string>();
  const taxonomy:string[]=[],priceStates:string[]=[],eligibility:string[]=[];
  for(const [index,r] of raw.entries()){
   const linked=byRaw.get(r.id);
   const item=normalizeAwinItem({raw:r.raw_payload,rowNumber:index+1},{feedId});
   if(isInvalidAwinItem(item)||item.provenance.merchantId!==merchant)throw Error("INVALID_RAW_ITEM");
   if(Math.abs(item.offer.currentPrice-linked.price)>.011)throw Error("STAGED_PRICE_MISMATCH");
   if(seenVariants.has(linked.variant_id)||seenOffers.has(linked.offer_id))throw Error("DUPLICATE_JOIN");
   seenVariants.add(linked.variant_id);seenOffers.add(linked.offer_id);
   const assessment=assessAwinCatalogCandidate(item),evidence=createCatalogPriceEvidence(item);
   taxonomy.push(assessment.taxonomy.universe);priceStates.push(evidence.status);eligibility.push(assessment.eligibility.status);
   if(evidence.status!=="REVIEW_REQUIRED"){
    if(evidence.compatibilityPreviousPrice===null)throw Error("NO_COMPATIBLE_PRICE");
    priceRows.push({offerId:linked.offer_id,status:evidence.status,price:evidence.currentPrice,
     old:evidence.compatibilityPreviousPrice,percent:evidence.discountPercent,type:evidence.evidenceType});
   }
   const group=groups.get(linked.product_id)??[];group.push({item,assessment});groups.set(linked.product_id,group);
   const audience=classifyAudience({suitableFor:item.raw.payload["Fashion:suitable_for"],categoryPath:item.product.category.path,name:item.product.name});
   const size=normalizeCatalogSize(item.variant.size,audience),color=normalizeCatalogColour(item.variant.colour);
   normalizations.push({variantId:linked.variant_id,sizeRaw:size.raw,sizeNormalized:size.normalized,sizeStatus:size.status,
    colourRaw:color.raw,colourNormalized:color.normalized,colourStatus:color.status,colourTaxonomy:color.taxonomy,
    normalizerVersion:CATALOG_NORMALIZER_VERSION,normalizedAt:now,reasonCodes:[size.reasonCode,color.reasonCode]});
  }
  const classifications:ClassificationWrite[]=[];
  for(const [productId,g] of groups){
   const t=g[0].assessment.taxonomy,anyOut=g.some(x=>x.assessment.taxonomy.universe==="NON_SNEAKER");
   const allOK=g.every(x=>x.assessment.eligibility.status==="IN_SCOPE_CONFIRMED");
   const state=anyOut?"OUT_OF_SCOPE":allOK?"CATALOG_ELIGIBLE":"QUARANTINED";
   classifications.push({productId,providerId:m.provider_id,merchantId:m.id,
    universe:anyOut?"NON_SNEAKER":t.universe,style:t.style,activities:[...new Set(g.flatMap(x=>x.assessment.taxonomy.activities))],
    confidence:t.confidence,reasonCodes:[...new Set(g.flatMap(x=>[...x.assessment.taxonomy.reasons,...x.assessment.eligibility.reasons]))],
    operationalState:state,classifierVersion:CATALOG_CLASSIFIER_VERSION,classifiedAt:now,
    sourceEvidence:{merchant,feedId,priceStates:[...new Set(g.map(x=>x.assessment.price.status))],version:"regular-staging-v1"}});
  }
  const baseline=(await client.query("SELECT count(*)::int n FROM offer_promotion_evidence pe JOIN offers o ON o.id=pe.offer_id WHERE o.merchant_id<>$1",[m.id])).rows[0].n;
  let insertedEvidence=0;let classResult:null|unknown=null,normResult:null|unknown=null;
  if(commit){
   const constraints=(await client.query("SELECT conname,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid IN ('offer_promotion_evidence'::regclass,'catalog_search_products'::regclass) AND conname IN ('chk_offer_promotion_price_order','chk_offer_promotion_discount','chk_catalog_search_prices','chk_catalog_search_discount')")).rows;
   if(constraints.length!==4||constraints.some(x=>!String(x.definition).includes("REGULAR_PRICE")))throw Error("MIGRATION_0014_NOT_APPLIED");
   const prior=(await client.query("SELECT count(*)::int n FROM offer_promotion_evidence pe JOIN offers o ON o.id=pe.offer_id WHERE o.merchant_id=$1",[m.id])).rows[0].n;
   if(prior)throw Error("PRICE_EVIDENCE_ALREADY_EXISTS");
   for(let i=0;i<priceRows.length;i+=500){
    const part=priceRows.slice(i,i+500).map(x=>({offer_id:x.offerId,status:x.status,price:x.price,old:x.old,percent:x.percent,type:x.type}));
    const insert="INSERT INTO offer_promotion_evidence(offer_id,feed_id,promotion_status,promotion_evidence_type,old_price,current_price,discount_percent,evidence_source,evidence_observed_at) SELECT x.offer_id,$2,x.status,x.type,x.old,x.price,x.percent,'AWIN_FEED_PRICE_STATE_V1',$3::timestamp FROM jsonb_to_recordset($1::jsonb) AS x(offer_id text,status text,type text,old numeric,price numeric,percent numeric) ON CONFLICT(offer_id,evidence_source) DO NOTHING";
    insertedEvidence+=(await client.query(insert,[JSON.stringify(part),dbFeed,now])).rowCount??0;
   }
   if(insertedEvidence!==priceRows.length)throw Error("EVIDENCE_INSERT_MISMATCH");
   classResult=await persistClassifications(client,classifications);
   normResult=await persistNormalizations(client,normalizations);
   const after=(await client.query("SELECT count(*)::int n FROM offer_promotion_evidence pe JOIN offers o ON o.id=pe.offer_id WHERE o.merchant_id<>$1",[m.id])).rows[0].n;
   if(after!==baseline)throw Error("OTHER_MERCHANT_EVIDENCE_CHANGED");
   await client.query("COMMIT");
  }else await client.query("ROLLBACK");
  console.log(JSON.stringify({mode:commit?"STAGING_WRITTEN":"READ_ONLY_DRY_RUN",merchant,feedId,
   rawCount:raw.length,productGroups:groups.size,priceStates:count(priceStates),taxonomy:count(taxonomy),
   rowEligibility:count(eligibility),classification:count(classifications.map(x=>x.operationalState)),
   evidenceCandidates:priceRows.length,insertedEvidence,classResult,normResult,
   otherMerchantEvidenceBaseline:baseline,offersActivated:0,projectionMutations:0},null,2));
 }catch(e){try{await client.query("ROLLBACK")}catch{}throw e}
 finally{client.release();await pool.end()}
}
void main().catch(e=>{console.error(e instanceof Error?e.message:"STAGE_ERROR");process.exitCode=1});
