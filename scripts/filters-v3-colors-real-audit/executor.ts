import { analyzeColors, SOURCES, type ColorFrequency } from "./analysis";
import * as q from "./queries";

export interface AuditClient {
  on?(event:"error", listener:(error:unknown)=>void):unknown;
  connect(): Promise<unknown>;
  query(sql: string, params?: unknown[]): Promise<{rows: Record<string, any>[]} >;
  end(): Promise<unknown>;
}
export type ClientSettings = {
  connectionString: string; statement_timeout: number; lock_timeout: number;
  connectionTimeoutMillis: number; application_name: string; options: string;
};
export type ClientFactory = (settings: ClientSettings) => AuditClient;
export class AuditError extends Error {
  constructor(public readonly code: "DATABASE_URL_REQUIRED" | "READ_ONLY_REQUIRED" | "TIMEOUT_GUARD_FAILED" |
    "ISOLATION_GUARD_FAILED" | "SEARCH_PATH_GUARD_FAILED" | "SCHEMA_REQUIRED_COLUMNS_MISSING" | "DISTINCT_LIMIT_EXCEEDED" |
    "AUDIT_OPERATION_FAILED" | "ROLLBACK_FAILED" | "CONNECTION_CLOSE_FAILED" | "OUTPUT_FAILED" | "OUTPUT_LIMIT_EXCEEDED" | "INVALID_ARGUMENTS") {
    super(code); this.name = "AuditError";
  }
}
/** Intentionally never include original message/detail/stack: driver errors can contain secrets. */
export function safeError(error: unknown): string {
  return error instanceof AuditError ? error.code : "AUDIT_OPERATION_FAILED";
}
const hasColumns = (rows: Record<string, any>[], table: string, columns: string[]) =>
  columns.every(column=>rows.some(row=>row.table_name===table && row.column_name===column));
const unsupported = (metric:string, reason:string) => ({metric,status:"UNSUPPORTED_BY_CURRENT_SCHEMA",reason});

/** Dependency injection keeps tests offline. Environment is explicit, never searched or loaded. */
export async function auditColors(
  environment: {DATABASE_URL?: string}, factory: ClientFactory,
  writeOutput: (report: Record<string, any>)=>Promise<void>,
) {
  if (!environment.DATABASE_URL?.trim()) throw new AuditError("DATABASE_URL_REQUIRED");
  let client: AuditClient;
  try {
    client = factory({connectionString:environment.DATABASE_URL,statement_timeout:60_000,lock_timeout:2_000,
      connectionTimeoutMillis:10_000,application_name:"uppulse_filters_v3_colors_read_only",
      options:"-c search_path=pg_catalog,public"});
  } catch { throw new AuditError("AUDIT_OPERATION_FAILED"); }
  let unexpectedConnectionError=false;
  client.on?.("error",()=>{unexpectedConnectionError=true;});
  let connected=false, failure:unknown, report:Record<string,any>|undefined;
  let rollbackCompleted=false, queryCount=0;
  const timings:Record<string,number>={};
  const started=performance.now();
  const query = async(name:string, sql:string, params?:unknown[])=>{
    if(unexpectedConnectionError && name!=="rollback") throw new AuditError("AUDIT_OPERATION_FAILED");
    const before=performance.now(); queryCount++;
    try {return (await client.query(sql,params)).rows;}
    finally {timings[name]=+(performance.now()-before).toFixed(3);}
  };
  try {
    await client.connect(); connected=true;
    await query("begin","BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    // Transaction-local settings are authoritative; startup parameters alone may not take effect.
    await query("setStatementTimeout","SET LOCAL statement_timeout = '60000ms'");
    await query("setLockTimeout","SET LOCAL lock_timeout = '2000ms'");
    await query("setSearchPath","SET LOCAL search_path = pg_catalog, public");
    const guard=(await query("safetyGuard",q.GUARD_SQL))[0];
    if(guard?.read_only!=="on") throw new AuditError("READ_ONLY_REQUIRED");
    if(guard?.isolation_level!=="repeatable read") throw new AuditError("ISOLATION_GUARD_FAILED");
    if(guard?.timeouts_bounded!==true) throw new AuditError("TIMEOUT_GUARD_FAILED");
    // GUARD_SQL compares configured/resolved paths in PostgreSQL; pg may return name[] as text.
    if(guard?.search_path_safe!==true) throw new AuditError("SEARCH_PATH_GUARD_FAILED");
    const schema=await query("schema",q.SCHEMA_SQL,[Object.keys({...q.REQUIRED_COLUMNS,...q.OPTIONAL_COLUMNS})]);
    if(!Object.entries(q.REQUIRED_COLUMNS).every(([table,columns])=>hasColumns(schema,table,columns))) {
      throw new AuditError("SCHEMA_REQUIRED_COLUMNS_MISSING");
    }
    const feedSupported=hasColumns(schema,"commerce_feeds",q.OPTIONAL_COLUMNS.commerce_feeds)
      && hasColumns(schema,"commerce_raw_feed_items",q.OPTIONAL_COLUMNS.commerce_raw_feed_items);
    const stockSupported=hasColumns(schema,"offers",q.OPTIONAL_COLUMNS.offers);
    const globalMetrics=(await query("global",q.GLOBAL_SQL))[0]?.metrics;
    if(!globalMetrics) throw new AuditError("AUDIT_OPERATION_FAILED");
    for(const source of ["products","variants"]) {
      globalMetrics[source].without_color=globalMetrics[source].nulls+globalMetrics[source].empty+globalMetrics[source].whitespace;
    }
    globalMetrics.projection.without_color=globalMetrics.projection.total-globalMetrics.projection.with_color;
    const distribution=await query("distributions",q.DISTRIBUTION_SQL,[q.DISTINCT_LIMIT+1]) as ColorFrequency[];
    for(const source of SOURCES) {
      if(distribution.filter(row=>row.source===source).length>q.DISTINCT_LIMIT) throw new AuditError("DISTINCT_LIMIT_EXCEEDED");
    }
    const analyses=Object.fromEntries(SOURCES.map(source=>[source,analyzeColors(distribution.filter(row=>row.source===source))]));
    const scoped=await query("scoped",q.SCOPED_SQL);
    const scopedTop=await query("scopedTop",q.SCOPED_TOP_SQL);
    const topByScope=new Map<string,Record<string,any>[]>();
    for(const row of scopedTop) {
      const key=`${row.scope}:${row.scope_id}`;
      const items=topByScope.get(key)??[]; items.push(row);topByScope.set(key,items);
    }
    const scopes:Record<string,any>[]=scoped.map(row=>({...row,topColors:topByScope.get(`${row.scope}:${row.scope_id}`)??[]}));
    const comparison=(await query("comparison",q.COMPARISON_SQL))[0]?.metrics;
    if(!comparison) throw new AuditError("AUDIT_OPERATION_FAILED");
    comparison.histograms=["variant","projection"].flatMap(source=>Array.from({length:5},(_,bucket)=>({
      source,bucket,label:bucket===4?"4+":String(bucket),
      products:comparison.histograms?.find((row:Record<string,any>)=>row.source===source && row.bucket===bucket)?.products??0,
    })));
    const parameters=SOURCES.flatMap(source=>[analyses[source].impactParameters.changedValues,analyses[source].impactParameters.collisionValues]);
    const impacts=(await query("roundTripProductImpact",q.IMPACT_SQL,parameters))[0]?.metrics;
    const availability=stockSupported?(await query("availability",q.AVAILABILITY_SQL))[0]:undefined;
    if(availability) availability.colored_variant_stock_coverage_percent=availability.colored_variants
      ? +(100*availability.colored_variants_with_stock_offer/availability.colored_variants).toFixed(4):null;
    const feeds=feedSupported?await query("feeds",q.FEED_SQL):undefined;
    const unsupportedMetrics=[
      unsupported("feedProductAndProjectionColors","feed_id in external identities is an observed association, not a unique lineage for each variant/projection color; source_snapshot is not a relational feed link. Only raw feed colour is measured."),
      unsupported("primaryAndProjectionFrequencyVariantCount","primary/projection values are not linked unambiguously to individual variants; no fabricated expansion join."),
      unsupported("colorSizeJointPurchasability","Stock EXISTS reports only observed offer.in_stock; size, representative price, promotion and freshness require Filters V5."),
    ];
    if(!stockSupported) unsupportedMetrics.push(unsupported("variantStockCoverage","Required offers columns are absent; leave joint availability to V5."));
    if(!feedSupported) unsupportedMetrics.push(unsupported("rawFeedColors","Required raw/feed columns are absent."));
    report={
      metadata:{audit:"UPPULSE_FILTERS_V3_COLORS_REAL_AUDIT",version:1,generatedAt:new Date().toISOString(),
        classification:"OBSERVATIONAL_NOT_TAXONOMY",topLimit:q.TOP_LIMIT,exampleLimit:q.EXAMPLE_LIMIT,
        distinctLimitPerSource:q.DISTINCT_LIMIT,longValueThresholdCodePoints:120,
        projectionColumn:"catalog_search_products.normalized_colors",
        units:{variant:"variant rows",primary:"product rows",projection:"distinct product+merchant per exact element"},
        joins:"product associations = UNION of variant, projection and external-identity product/merchant/provider IDs; products can belong to multiple merchants",
        roundTrip:"Existing catalogState helpers then CSV parser; STABLE/CHANGED partition values; COLLISION overlaps both. Percentages exclude NULL but include empty/whitespace strings."},
      safety:{singleConnection:true,transaction:"REPEATABLE READ READ ONLY",readOnlyVerified:true,
        timeoutsVerified:true,searchPathVerified:true,statementTimeoutMs:60_000,lockTimeoutMs:2_000,
        predefinedSelectsOnly:true,rollbackCompleted:false,credentialsIncluded:false},
      schemaCapabilities:{requiredColumnsVerified:true,rawFeedColors:feedSupported,variantStockCoverage:stockSupported,
        feedProductAndProjectionColors:"UNSUPPORTED_BY_CURRENT_SCHEMA"},
      globalMetrics,merchantMetrics:scopes.filter(row=>row.scope==="merchant"),
      providerMetrics:scopes.filter(row=>row.scope==="provider"),
      feedMetrics:feeds??{status:"UNSUPPORTED_BY_CURRENT_SCHEMA"},
      variantColors:analyses.variant.distribution,primaryColors:analyses.primary.distribution,projectionColors:analyses.projection.distribution,
      textualVariationCandidates:Object.fromEntries(SOURCES.map(source=>[source,analyses[source].textualVariationCandidates])),
      formatMetrics:Object.fromEntries(SOURCES.map(source=>[source,analyses[source].formatMetrics])),
      compoundColorCandidates:Object.fromEntries(SOURCES.map(source=>[source,analyses[source].compoundColorCandidates])),
      variantProjectionComparison:{...comparison,availability:availability??{status:"UNSUPPORTED_BY_CURRENT_SCHEMA"},
        semantics:"Exact scalar/element comparisons, no split/aliases. Pair counts use product+merchant; histograms use unique products across merchants, including products with no variants/projection. Stock is descriptive, not joint purchasability."},
      roundTripAnalysis:Object.fromEntries(SOURCES.map(source=>[source,{...analyses[source].roundTripAnalysis,affectedProducts:impacts?.[source]}])),
      unsupportedMetrics,
      warnings:["Textual variation and compound groups are candidates, never confirmed aliases or semantic color splits.",
        "Exact raw versus derived differences are expected after prior normalization and do not establish corruption.",
        "Global primary totals include unassociated products; merchant/provider associations may overlap and must not be summed as unique products.",
        "Occurrences are source units, not unique affected products. affectedProducts counts are computed separately with DISTINCT/EXISTS-safe predicates.",
        "Feed metrics describe raw_payload.colour only, no guessed alternate feed columns or product lineage.",
        "Projection distribution deduplicates repeated elements per product+merchant; projectionElements global metrics also show stored occurrences.",
        "READ ONLY and fixed queries do not replace a database role with SELECT-only privileges; use a externally supplied read-only account."],
      timings,
    };
  } catch(error) { failure=error instanceof AuditError?error:new AuditError("AUDIT_OPERATION_FAILED"); }
  finally {
    if(connected) {
      try {await query("rollback","ROLLBACK"); rollbackCompleted=true;}
      catch {failure=new AuditError("ROLLBACK_FAILED");}
    }
    try {await client.end();} catch {failure=failure??new AuditError("CONNECTION_CLOSE_FAILED");}
  }
  if(unexpectedConnectionError && !failure) failure=new AuditError("AUDIT_OPERATION_FAILED");
  if(failure) throw failure;
  if(!report || !rollbackCompleted) throw new AuditError("AUDIT_OPERATION_FAILED");
  report.safety.rollbackCompleted=true;
  report.timings={...timings,totalMs:+(performance.now()-started).toFixed(3),sqlRoundTrips:queryCount};
  try {await writeOutput(report);} catch(error) {throw error instanceof AuditError?error:new AuditError("OUTPUT_FAILED");}
  return report;
}
