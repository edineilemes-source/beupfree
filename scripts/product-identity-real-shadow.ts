/** Explicit manual invocation only. Never loads dotenv or imports a persistence path. */
import pg from "pg";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { adaptReconciledRows, type ReconciledRow } from "../server/productIdentity/adapter";
import { runShadow } from "../server/productIdentity/shadow";
import { canonical, compare, digest } from "../server/productIdentity/contracts";

export const OUTPUT = "/tmp/product-identity-real-shadow-v1.json";
export interface Source {
  id: string; productId: string; providerId: string; merchantId: string; feedId: string | null;
  externalProductKey: string; name: string; brandId: string | null; brandName: string | null;
  rawBrand: string | null; rawBrandCount: number; merchantName: string; providerCode: string;
  updatedAt: string | null; lastSeenAt: string; provenanceMethod: string;
}
export interface ReadClient {
  connect(): Promise<unknown>;
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
  end(): Promise<unknown>;
}
export const SQL = {
  universe: `SELECT
    (SELECT count(*)::int FROM products) products,
    (SELECT count(*)::int FROM external_product_identities) identities,
    (SELECT count(*)::int FROM product_variants) variants,
    (SELECT count(*)::int FROM commerce_providers) providers,
    (SELECT count(*)::int FROM commerce_merchants) merchants,
    (SELECT count(*)::int FROM commerce_feeds) feeds,
    (SELECT count(*)::int FROM brands) brands`,
  sources: `WITH raw_brands AS (
    SELECT v.product_id,v.provider_id,v.merchant_id,r.feed_id,
      min(nullif(btrim(r.raw_payload->>'brand_name'),'')) brand,
      count(DISTINCT lower(nullif(btrim(r.raw_payload->>'brand_name'),'')))::int brand_count
    FROM product_variants v JOIN commerce_raw_feed_items r
      ON r.provider_id=v.provider_id AND r.merchant_id=v.merchant_id
      AND r.merchant_product_id=v.merchant_product_id
    GROUP BY v.product_id,v.provider_id,v.merchant_id,r.feed_id
  ) SELECT e.id,e.product_id "productId",e.provider_id "providerId",e.merchant_id "merchantId",
    e.feed_id "feedId",e.external_product_key "externalProductKey",e.provenance_method "provenanceMethod",
    e.last_seen_at::text "lastSeenAt",p.updated_at::text "updatedAt",p.main_name name,
    p.brand_id "brandId",b.name "brandName",rb.brand "rawBrand",coalesce(rb.brand_count,0) "rawBrandCount",
    m.name "merchantName",cp.code "providerCode"
    FROM external_product_identities e JOIN products p ON p.id=e.product_id
    JOIN commerce_merchants m ON m.id=e.merchant_id AND m.provider_id=e.provider_id
    JOIN commerce_providers cp ON cp.id=e.provider_id LEFT JOIN brands b ON b.id=p.brand_id
    LEFT JOIN raw_brands rb ON rb.product_id=e.product_id AND rb.provider_id=e.provider_id
      AND rb.merchant_id=e.merchant_id AND rb.feed_id=e.feed_id ORDER BY e.id`,
  feeds: `SELECT id,provider_id "providerId",merchant_id "merchantId" FROM commerce_feeds WHERE id=ANY($1::text[]) ORDER BY id`,
  variants: `SELECT id,product_id "productId",provider_id "providerId",merchant_id "merchantId",
    external_variant_key "externalVariantKey",size,colour,gtin,ean,upc,mpn,
    provenance_method "provenanceMethod",updated_at::text "updatedAt",last_seen_at::text "lastSeenAt"
    FROM product_variants WHERE product_id=ANY($1::text[]) ORDER BY id`,
};
const fold = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const sourceBrand = (s: Source) => s.brandName?.trim() || (s.rawBrandCount === 1 ? s.rawBrand?.trim() : null) || null;
const merchantKey = (s: Source) => canonical([s.providerId, s.merchantId]);
/** Inverted brand/token index, then ranked round-robin across all provider/merchant buckets.
 * This is retrieval for cohort selection only; it never emits identity decisions. */
export function selectCohort(sources: Source[], limit = 2000) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 2000) throw new Error("COHORT_LIMIT_INVALID");
  const index = new Map<string, Set<string>>();
  const tokens = new Map<string, string[]>();
  for (const s of sources) {
    const brand = sourceBrand(s);
    const keys = brand ? [...new Set(fold(s.name).split(/[^a-z0-9]+/).filter(t => t.length >= 3))]
      .map(t => canonical([fold(brand), t])) : [];
    tokens.set(s.id, keys);
    for (const key of keys) { const merchants = index.get(key) ?? new Set(); merchants.add(merchantKey(s)); index.set(key, merchants); }
  }
  const score = (s: Source) => (tokens.get(s.id) ?? []).filter(k => index.get(k)!.size > 1).length;
  const buckets = new Map<string, Source[]>();
  for (const s of sources) { const key = merchantKey(s), rows = buckets.get(key) ?? []; rows.push(s); buckets.set(key, rows); }
  for (const rows of buckets.values()) rows.sort((a,b) => score(b)-score(a) || compare(a.id,b.id));
  const keys = [...buckets.keys()].sort(compare), selected: Source[] = [];
  for (let rank=0; selected.length < limit; rank++) {
    let found = false;
    for (const key of keys) { const row = buckets.get(key)![rank]; if (row && selected.length < limit) { selected.push(row); found=true; } }
    if (!found) break;
  }
  return selected.sort((a,b) => compare(a.id,b.id));
}
const distribution = (rows: Source[], key: (s: Source) => string) => {
  const result: Record<string, number> = Object.create(null);
  for (const row of rows) { const k=key(row); result[k]=(result[k]??0)+1; }
  return result;
};
export async function executeRealShadow(env: NodeJS.ProcessEnv, factory: (url: string) => ReadClient,
  save: (path: string, content: string) => Promise<unknown> = writeFile) {
  const url = env.AWIN_CATALOG_ADMIN_DATABASE_URL;
  if (!url) throw new Error("AWIN_CATALOG_ADMIN_DATABASE_URL_REQUIRED");
  const started=performance.now();
  let client: ReadClient;
  try { client=factory(url); } catch { throw new Error("REAL_SHADOW_CONNECTION_FAILED"); }
  let transactionAttempted=false, rollback=false, phase="CONNECTION";
  try {
    await client.connect(); phase="READ_ONLY"; transactionAttempted=true;
    await client.query("BEGIN READ ONLY");
    const proof=await client.query("SHOW transaction_read_only");
    if (proof.rows[0]?.transaction_read_only !== "on") throw new Error("READ_ONLY_NOT_PROVEN");
    phase="READS";
    const universe=(await client.query(SQL.universe)).rows[0];
    const sources=(await client.query(SQL.sources)).rows as Source[];
    const cohort=selectCohort(sources);
    const feeds=(await client.query(SQL.feeds, [[...new Set(cohort.map(s=>s.feedId).filter(Boolean))]])).rows;
    const variants=(await client.query(SQL.variants, [[...new Set(cohort.map(s=>s.productId))]])).rows;
    const readMs=performance.now()-started;
    const iso = (value: string | null) => value == null ? null : new Date(value).toISOString();
    const rows: ReconciledRow[]=cohort.map(s=>({
      product:{id:s.productId,mainName:s.name,brandId:s.brandId,updatedAt:iso(s.updatedAt)},
      identity:{id:s.id,productId:s.productId,providerId:s.providerId,merchantId:s.merchantId,
        feedId:s.feedId,externalProductKey:s.externalProductKey,provenanceMethod:s.provenanceMethod,lastSeenAt:iso(s.lastSeenAt)},
      provider:{id:s.providerId},merchant:{id:s.merchantId,providerId:s.providerId},
      feed:s.feedId ? feeds.find(f=>f.id===s.feedId) : null,
      brand:s.brandId && s.brandName ? {id:s.brandId,name:s.brandName} : null,
      variants:variants.filter(v=>v.productId===s.productId && v.providerId===s.providerId && v.merchantId===s.merchantId).map(v=>({...v,updatedAt:iso(v.updatedAt),lastSeenAt:iso(v.lastSeenAt)})),
    }));
    phase="SHADOW";
    const products=adaptReconciledRows(rows);
    // Local input enrichment only. No fabricated brands.id or incorrect brands provenance.
    const byId=new Map(cohort.map(s=>[s.id,s]));
    for (const p of products) { const s=byId.get(p.externalIdentityId)!; if (!p.input.brand && sourceBrand(s)) p.input.brand=sourceBrand(s); }
    const shadow=runShadow(products), l=shadow.logical;
    const snapshots=new Map(l.snapshots.map(s=>[s.key,s]));
    const degree=new Map(l.snapshots.map(s=>[s.key,0]));
    for (const pair of l.candidates) for (const k of [pair.left,pair.right]) degree.set(k,degree.get(k)!+1);
    const multiMerchant=l.groups.filter(g=>new Set(g.members.map(k=>canonical([snapshots.get(k)!.providerId,snapshots.get(k)!.merchantId]))).size>1);
    const multiProvider=l.groups.filter(g=>new Set(g.members.map(k=>snapshots.get(k)!.providerId)).size>1);
    const sizes=l.groups.map(g=>g.members.length);
    const multiple=l.snapshots.filter(s=>degree.get(s.key)!>1).map(s=>({key:s.key,name:s.input.name,candidates:degree.get(s.key)}));
    const report={timestamp:new Date().toISOString(),transactionReadOnly:"on",universe,
      universeDistribution:{availableMerchantProducts:sources.length,brands:distribution(sources,s=>sourceBrand(s)??"UNKNOWN"),merchants:distribution(sources,merchantKey),providers:distribution(sources,s=>s.providerId)},
      cohort:{criterion:"brand-token cross-merchant presence score; per-merchant rank; deterministic round-robin; id tie-break; no active/publication filters",limit:2000,total:cohort.length,
        merchants:distribution(cohort,merchantKey),providers:distribution(cohort,s=>s.providerId),brands:distribution(cohort,s=>sourceBrand(s)??"UNKNOWN"),
        directory: [...new Map(sources.map(s=>[merchantKey(s),{providerId:s.providerId,providerCode:s.providerCode,merchantId:s.merchantId,merchantName:s.merchantName}])).values()],
        brandEvidence:cohort.map(s=>({identityId:s.id,source:s.brandName?.trim()?"brands.name":sourceBrand(s)?"commerce_raw_feed_items.raw_payload.brand_name via product_variants.merchant_product_id; same provider/merchant/feed; one distinct case-insensitive value":"NONE",brand:sourceBrand(s),rawBrandCount:s.rawBrandCount})),
        manifestHash:digest(cohort.map(s=>s.id))},
      candidateGeneration:{generated:l.candidates.length,retrievalComparisons:l.identityCoverage.retrievalComparisons,
        noCandidate:[...degree.values()].filter(n=>n===0).length,oneCandidate:[...degree.values()].filter(n=>n===1).length,multipleCandidates:multiple.length},
      evaluatedPairs:l.pairs.length,pairwiseVerification:{additionalPairs:l.pairs.filter(p=>p.purpose==="GROUP_VERIFICATION").length,blockedMergeProposals:l.groupConflicts.length,policy:"V1.3 accepts a merge only when every boundary pair is AUTO_MATCH; NOT_EVALUATED blocks merging"},master:l.identityCoverage.master,variant:l.identityCoverage.variant,
      groups:{total:l.groups.length,singletons:sizes.filter(n=>n===1).length,two:sizes.filter(n=>n===2).length,three:sizes.filter(n=>n===3).length,fourPlus:sizes.filter(n=>n>=4).length,largest:Math.max(0,...sizes),multiMerchant:multiMerchant.length,multiProvider:multiProvider.length,
        suspicious:l.groupConflicts.length,suspiciousCriterion:"blocked merge proposals from V1.3 complete pair verification; not accepted groups",conflicts:l.groupConflicts},
      truncations:{coverageLimited:l.coverageLimited,topK:l.truncatedCandidates.length,unexaminedPairs:l.identityCoverage.unexaminedPairs,unevaluatedPairs:l.unevaluatedPairs.length},budgets:l.config,
      samples:{autoMatch:l.pairs.filter(p=>p.result.masterDecision==="AUTO_MATCH").slice(0,30),review:l.pairs.filter(p=>p.result.masterDecision==="REVIEW").slice(0,30),noMatch:l.pairs.filter(p=>p.result.masterDecision==="NO_MATCH").slice(0,30),multiMerchant:multiMerchant.slice(0,30),threePlus:l.groups.filter(g=>g.members.length>=3).slice(0,30),largest:[...l.groups].sort((a,b)=>b.members.length-a.members.length||compare(a.id,b.id)).slice(0,30),multipleCandidates:multiple.slice(0,30)},
      commercialIsolation:"No commercial writes, eligibility filters, offers, affiliate URLs or publishing/import paths invoked.",
      limitations:["Cohort retrieval is a heuristic, not a representative quality estimate or identity decision.","Brand conflicts are not resolved; missing brand may prevent V1.3 candidates.","PRODUCT_TITLE scope; no implicit variant selection or GTIN/MPN rollup.","V1.3 retrieval budgets/top-K may limit coverage; original matcher/grouping unchanged."],
      shadow, timings:{readAndSelectionMs:readMs,shadowMs:shadow.measurements.elapsedMs,totalMs:0},rollback:false};
    phase="ROLLBACK"; await client.query("ROLLBACK");rollback=true;report.rollback=true;
    report.timings.totalMs=performance.now()-started;
    phase="OUTPUT"; const content=JSON.stringify(report,null,2)+"\n";
    if (content.includes(url)) throw new Error("OUTPUT_SECRET_REJECTED");
    await save(OUTPUT,content);return report;
  } catch { throw new Error(`REAL_SHADOW_${phase}_FAILED`); }
  finally {
    try { if (transactionAttempted && !rollback) await client.query("ROLLBACK"); }
    catch { throw new Error("REAL_SHADOW_ROLLBACK_FAILED"); }
    finally { try { await client.end(); } catch { throw new Error("REAL_SHADOW_CLOSE_FAILED"); } }
  }
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  executeRealShadow(process.env,url=>new pg.Client({connectionString:url,connectionTimeoutMillis:15000,query_timeout:120000}))
    .then(()=>console.log(`REAL_SHADOW_REPORT: ${OUTPUT}`))
    .catch(()=>{console.error("REAL_SHADOW_FAILED: verify connection, READ ONLY, schema and output permissions; credentials suppressed.");process.exitCode=1;});
}
