import type pg from "pg";
import type { CatalogOperationalState, NormalizationStatus } from "./operationalCatalog";
import type { ProductActivity, ProductStyle, ProductUniverse, TaxonomyConfidence } from "./productTaxonomy";

export const DAFITI_CATALOG_MERCHANT = "17697";
export type PersistenceConfig={connectionString:string;expectedHost:string;database:string;merchant:string;classifierVersion:string;normalizerVersion:string};

function argumentValue(args:string[],name:string):string|undefined{return args.find(value=>value.startsWith(`${name}=`))?.slice(name.length+1);}
export function validatePersistenceInvocation(args:string[],env:NodeJS.ProcessEnv):PersistenceConfig{
 const connectionString=env.AWIN_CATALOG_ADMIN_DATABASE_URL;
 if(!connectionString)throw new Error("AWIN_CATALOG_ADMIN_DATABASE_URL_REQUIRED");
 if(argumentValue(args,"--mode")!=="staging"||!args.includes("--confirm-staging"))throw new Error("EXPLICIT_STAGING_CONFIRMATION_REQUIRED");
 const merchant=argumentValue(args,"--merchant");if(merchant!==DAFITI_CATALOG_MERCHANT)throw new Error("DAFITI_MERCHANT_REQUIRED");
 const classifierVersion=argumentValue(args,"--classifier-version"),normalizerVersion=argumentValue(args,"--normalizer-version");
 if(!classifierVersion||!normalizerVersion)throw new Error("EXPLICIT_VERSIONS_REQUIRED");
 const expectedHost=env.AWIN_CATALOG_EXPECTED_HOST;if(!expectedHost)throw new Error("AWIN_CATALOG_EXPECTED_HOST_REQUIRED");
 const url=new URL(connectionString),database=url.pathname.slice(1);if(url.hostname!==expectedHost)throw new Error("DATABASE_HOST_MISMATCH");if(database!=="postgres")throw new Error("DATABASE_NAME_MISMATCH");
 return {connectionString,expectedHost,database,merchant,classifierVersion,normalizerVersion};
}
export function assertAdministrativeIdentity(input:{currentUser:string;currentDatabase:string},config:PersistenceConfig):void{
 if(input.currentUser==="awin_curator")throw new Error("READ_ONLY_CURATOR_CANNOT_PERSIST");
 if(input.currentDatabase!==config.database)throw new Error("CONNECTED_DATABASE_MISMATCH");
}

export type ClassificationWrite={productId:string;providerId:string;merchantId:string;universe:ProductUniverse;style:ProductStyle;activities:ProductActivity[];confidence:TaxonomyConfidence;reasonCodes:string[];operationalState:CatalogOperationalState;classifierVersion:string;classifiedAt:string;sourceEvidence:Record<string,unknown>};
export type NormalizationWrite={variantId:string;sizeRaw:string|null;sizeNormalized:number|null;sizeStatus:NormalizationStatus;colourRaw:string|null;colourNormalized:string[]|null;colourStatus:NormalizationStatus;normalizerVersion:string;normalizedAt:string;reasonCodes:string[]};
export type PersistenceCounters={seen:number;created:number;unchanged:number;invalid:number};
const batches=<T>(rows:T[],size=1000)=>Array.from({length:Math.ceil(rows.length/size)},(_,i)=>rows.slice(i*size,(i+1)*size));
function assertUnique(rows:Array<{productId?:string;variantId?:string}>,key:"productId"|"variantId"):void{const values=rows.map(row=>row[key]);if(new Set(values).size!==values.length)throw new Error(`DUPLICATE_INPUT_${key.toUpperCase()}`);}

export async function persistClassifications(client:pg.PoolClient,rows:ClassificationWrite[]):Promise<PersistenceCounters>{
 assertUnique(rows,"productId");let created=0,invalid=0;
 for(const batch of batches(rows)){
  const payload=JSON.stringify(batch);
  const mismatch=await client.query(`WITH incoming AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS x("productId" text,"providerId" text,"merchantId" text,"universe" text,"style" text,"activities" text[],"confidence" text,"reasonCodes" text[],"operationalState" text,"classifierVersion" text,"classifiedAt" text,"sourceEvidence" jsonb)) SELECT count(*)::int count FROM incoming i JOIN product_catalog_classifications e ON e.product_id=i."productId" AND e.classifier_version=i."classifierVersion" WHERE (e.provider_id,e.merchant_id,e.universe,e.style,e.activities,e.confidence,e.reason_codes,e.operational_state::text,e.source_evidence) IS DISTINCT FROM (i."providerId",i."merchantId",i."universe",i."style",i."activities",i."confidence",i."reasonCodes",i."operationalState",i."sourceEvidence")`,[payload]);
  invalid+=mismatch.rows[0].count;if(invalid)throw new Error(`CLASSIFICATION_VERSION_CONFLICT:${invalid}`);
  const inserted=await client.query(`INSERT INTO product_catalog_classifications(product_id,provider_id,merchant_id,universe,style,activities,confidence,reason_codes,operational_state,classifier_version,classified_at,source_evidence) SELECT x."productId",x."providerId",x."merchantId",x."universe",x."style",x."activities",x."confidence",x."reasonCodes",x."operationalState"::catalog_operational_state,x."classifierVersion",x."classifiedAt"::timestamp,x."sourceEvidence" FROM jsonb_to_recordset($1::jsonb) AS x("productId" text,"providerId" text,"merchantId" text,"universe" text,"style" text,"activities" text[],"confidence" text,"reasonCodes" text[],"operationalState" text,"classifierVersion" text,"classifiedAt" text,"sourceEvidence" jsonb) ON CONFLICT (product_id,classifier_version) DO NOTHING RETURNING id`,[payload]);created+=inserted.rowCount??0;
 }
 return {seen:rows.length,created,unchanged:rows.length-created,invalid};
}

export async function persistNormalizations(client:pg.PoolClient,rows:NormalizationWrite[]):Promise<PersistenceCounters>{
 assertUnique(rows,"variantId");let created=0,invalid=0;
 for(const batch of batches(rows)){
  const payload=JSON.stringify(batch);
  const mismatch=await client.query(`WITH incoming AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS x("variantId" text,"sizeRaw" text,"sizeNormalized" numeric,"sizeStatus" text,"colourRaw" text,"colourNormalized" text[],"colourStatus" text,"normalizerVersion" text,"normalizedAt" text,"reasonCodes" text[])) SELECT count(*)::int count FROM incoming i JOIN product_variant_normalizations e ON e.variant_id=i."variantId" AND e.normalizer_version=i."normalizerVersion" WHERE (e.size_raw,e.size_normalized,e.size_status,e.colour_raw,e.colour_normalized,e.colour_status,e.reason_codes) IS DISTINCT FROM (i."sizeRaw",i."sizeNormalized",i."sizeStatus",i."colourRaw",i."colourNormalized",i."colourStatus",i."reasonCodes")`,[payload]);
  invalid+=mismatch.rows[0].count;if(invalid)throw new Error(`NORMALIZATION_VERSION_CONFLICT:${invalid}`);
  const inserted=await client.query(`INSERT INTO product_variant_normalizations(variant_id,size_raw,size_normalized,size_status,colour_raw,colour_normalized,colour_status,normalizer_version,normalized_at,reason_codes) SELECT x."variantId",x."sizeRaw",x."sizeNormalized",x."sizeStatus",x."colourRaw",x."colourNormalized",x."colourStatus",x."normalizerVersion",x."normalizedAt"::timestamp,x."reasonCodes" FROM jsonb_to_recordset($1::jsonb) AS x("variantId" text,"sizeRaw" text,"sizeNormalized" numeric,"sizeStatus" text,"colourRaw" text,"colourNormalized" text[],"colourStatus" text,"normalizerVersion" text,"normalizedAt" text,"reasonCodes" text[]) ON CONFLICT (variant_id,normalizer_version) DO NOTHING RETURNING id`,[payload]);created+=inserted.rowCount??0;
 }
 return {seen:rows.length,created,unchanged:rows.length-created,invalid};
}
