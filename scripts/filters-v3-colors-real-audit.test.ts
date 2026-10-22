import assert from "node:assert/strict";
import test from "node:test";
import { types as pgTypes } from "pg";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeColors, textualKeys, transport, type ColorFrequency } from "./filters-v3-colors-real-audit/analysis";
import { auditColors, AuditError, safeError, type AuditClient, type ClientSettings } from "./filters-v3-colors-real-audit/executor";
import * as q from "./filters-v3-colors-real-audit/queries";
import { COLOR_FIXTURE, UNKNOWN_MERCHANT_FIXTURE } from "./filters-v3-colors-real-audit/fixtures";
import { outputPath, writeJsonAtomic, clientOptions } from "./filters-v3-colors-real-audit";

const environment={DATABASE_URL:"synthetic-mock-only-not-a-connection"};
const schemaRows=()=>Object.entries({...q.REQUIRED_COLUMNS,...q.OPTIONAL_COLUMNS}).flatMap(([table,columns])=>columns.map(column=>({table_name:table,column_name:column})));
function fake(options:{guard?:Record<string,any>;failSql?:string;rollbackFails?:boolean;schema?:Record<string,any>[];distribution?:ColorFrequency[];endFails?:boolean;connectFails?:boolean;ignoreStatementTimeout?:boolean;ignoreLockTimeout?:boolean;ignoreSearchPath?:boolean}={}) {
  const calls:{sql:string;params?:unknown[]}[]=[];
  let ends=0,connects=0;
  let statementTimeout=120_000,lockTimeout=0;
  let searchPath='"$user", public, extensions';
  let searchSchemas=["public","extensions"];
  const guardTimeouts:{statementTimeout:number;lockTimeout:number}[]=[];
  const client:AuditClient={
    async connect(){connects++;if(options.connectFails)throw Error("sensitive connection error");},
    async query(sql,params){
      calls.push({sql,params});
      if(sql===options.failSql || (sql==="ROLLBACK" && options.rollbackFails)) throw Error("postgres://user:password@private.example/db secret=private");
      if(sql==="SET LOCAL statement_timeout = '60000ms'"){
        if(!options.ignoreStatementTimeout)statementTimeout=60_000;
        return {rows:[]};
      }
      if(sql==="SET LOCAL lock_timeout = '2000ms'"){
        if(!options.ignoreLockTimeout)lockTimeout=2_000;
        return {rows:[]};
      }
      if(sql==="SET LOCAL search_path = pg_catalog, public"){
        if(!options.ignoreSearchPath){searchPath="pg_catalog, public";searchSchemas=["pg_catalog","public"];}
        return {rows:[]};
      }
      if(sql===q.GUARD_SQL){
        guardTimeouts.push({statementTimeout,lockTimeout});
        return {rows:[{read_only:"on",timeouts_bounded:statementTimeout>0&&statementTimeout<=60_000&&lockTimeout>0&&lockTimeout<=2_000,search_schemas:searchSchemas,isolation_level:"repeatable read",search_path_safe:searchPath==="pg_catalog, public",...options.guard}]};
      }
      if(sql===q.SCHEMA_SQL)return {rows:options.schema??schemaRows()};
      if(sql===q.GLOBAL_SQL)return {rows:[{metrics:{products:{total:20,nulls:2,empty:1,whitespace:1},variants:{total:25,nulls:3,empty:2,whitespace:1},projection:{total:12,with_color:10}}}]};
      if(sql===q.DISTRIBUTION_SQL)return {rows:options.distribution??COLOR_FIXTURE};
      if(sql===q.SCOPED_SQL)return {rows:[UNKNOWN_MERCHANT_FIXTURE,{scope:"provider",scope_id:"provider-new",name:"future-provider"}]};
      if(sql===q.SCOPED_TOP_SQL)return {rows:[{scope:"merchant",scope_id:"merchant-new",entity:"projection",value:"café",frequency:8,products:8}]};
      if(sql===q.COMPARISON_SQL)return {rows:[{metrics:{divergentPairs:3,examples:[],histograms:[]}}]};
      if(sql===q.IMPACT_SQL)return {rows:[{metrics:{projection:{changedProducts:11,collisionProducts:12,changedRows:13,collisionRows:14},variant:{changedProducts:0},primary:{changedProducts:0}}}]};
      if(sql===q.AVAILABILITY_SQL)return {rows:[{colored_variants_with_stock_offer:4}]};
      if(sql===q.FEED_SQL)return {rows:[{feed_id:"feed-new",provider_id:"provider-new",merchant_id:"merchant-new",raw_rows:15,top:[]}]};
      if(sql.startsWith("BEGIN") || sql==="ROLLBACK")return {rows:[]};
      assert.fail("unexpected SQL");
    },
    async end(){ends++;if(options.endFails)throw Error("secret close error");},
  };
  return {client,calls,guardTimeouts,get ends(){return ends},get connects(){return connects}};
}

test("missing DATABASE_URL fails before client construction or output",async()=>{
  await assert.rejects(auditColors({},()=>assert.fail("factory"),async()=>assert.fail("write")),/DATABASE_URL_REQUIRED/);
});
test("success uses one connection, fixed SELECTs, startup timeouts and ROLLBACK before output",async()=>{
  const f=fake();let constructions=0,config:ClientSettings|undefined,writes=0;
  const report=await auditColors(environment,settings=>{constructions++;config=settings;return f.client;},async body=>{
    writes++;assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");assert.equal(f.ends,1);assert.equal(body.safety.rollbackCompleted,true);
  });
  assert.equal(constructions,1);assert.equal(f.connects,1);assert.equal(writes,1);
  assert.equal(config?.statement_timeout,60_000);assert.equal(config?.lock_timeout,2_000);
  assert.equal(f.calls[0].sql,"BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal(f.calls[1].sql,"SET LOCAL statement_timeout = '60000ms'");
  assert.equal(f.calls[2].sql,"SET LOCAL lock_timeout = '2000ms'");
  assert.equal(f.calls[3].sql,"SET LOCAL search_path = pg_catalog, public");
  assert.equal(f.calls[4].sql,q.GUARD_SQL);assert.equal(f.calls.length,15);assert.equal(report.timings.sqlRoundTrips,15);
  assert.deepEqual(f.guardTimeouts,[{statementTimeout:60_000,lockTimeout:2_000}]);
  assert.equal(report.variantProjectionComparison.histograms.length,10);
  assert.equal(report.globalMetrics.products.without_color,4);assert.equal(report.globalMetrics.projection.without_color,2);
  for(const call of f.calls.slice(4,-1))assert.match(call.sql,/^(SELECT|WITH)\b/);
  assert.equal(JSON.stringify(report).includes(environment.DATABASE_URL),false);
  assert.equal(report.roundTripAnalysis.projection.affectedProducts.changedProducts,11);
});
test("transaction_read_only off aborts before schema/data and attempts ROLLBACK",async()=>{
  const f=fake({guard:{read_only:"off",timeouts_bounded:true}});
  await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),/READ_ONLY_REQUIRED/);
  assert.equal(f.calls.length,6);assert.equal(f.calls[5].sql,"ROLLBACK");assert.equal(f.ends,1);
});
test("unbounded timeout or unsafe search_path aborts without metrics",async()=>{
  for(const [guard,code] of [[{read_only:"on",timeouts_bounded:false},"TIMEOUT_GUARD_FAILED"],
    [{read_only:"on",timeouts_bounded:true,search_schemas:["untrusted","public"],search_path_safe:false},"SEARCH_PATH_GUARD_FAILED"]] as const){
    const f=fake({guard});await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),new RegExp(code));
    assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");assert.equal(f.calls.some(c=>c.sql===q.GLOBAL_SQL),false);
  }
});
test("query error is sanitized and rollback/end are attempted",async()=>{
  const f=fake({failSql:q.DISTRIBUTION_SQL});
  await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),error=>{
    assert.equal(safeError(error),"AUDIT_OPERATION_FAILED");assert.equal(String(error).includes("password"),false);return true;
  });assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");assert.equal(f.ends,1);
});
test("BEGIN failure still attempts ROLLBACK on established connection",async()=>{
  const f=fake({failSql:"BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"});
  await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),/AUDIT_OPERATION_FAILED/);
  assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");assert.equal(f.ends,1);
});
test("ROLLBACK failure prevents success output and still closes",async()=>{
  const f=fake({rollbackFails:true});
  await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),/ROLLBACK_FAILED/);assert.equal(f.ends,1);
});
test("connection or close failure never writes a success report",async()=>{
  for(const options of [{connectFails:true},{endFails:true}]){
    const f=fake(options);await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()));assert.equal(f.ends,1);
  }
});
test("sanitization discards driver messages, details, connection string and stack",()=>{
  for(const error of [Error("password=abc postgres://user:abc@private"),{message:"secret",detail:"token"},"connection-secret"]){
    assert.equal(safeError(error),"AUDIT_OPERATION_FAILED");
  }
  assert.equal(safeError(new AuditError("READ_ONLY_REQUIRED")),"READ_ONLY_REQUIRED");
});
test("schema required columns fail closed; optional feed/stock explicitly unsupported",async()=>{
  const absent=fake({schema:[]});await assert.rejects(auditColors(environment,()=>absent.client,async()=>assert.fail()),/SCHEMA_REQUIRED_COLUMNS_MISSING/);
  const required=Object.entries(q.REQUIRED_COLUMNS).flatMap(([table,columns])=>columns.map(column=>({table_name:table,column_name:column})));
  const f=fake({schema:required});const result=await auditColors(environment,()=>f.client,async()=>{});
  assert.equal(result.feedMetrics.status,"UNSUPPORTED_BY_CURRENT_SCHEMA");assert.equal(result.schemaCapabilities.variantStockCoverage,false);
  assert.ok(result.unsupportedMetrics.some((m:any)=>m.metric==="feedProductAndProjectionColors"));
  assert.equal(f.calls.some(c=>c.sql===q.FEED_SQL||c.sql===q.AVAILABILITY_SQL),false);
});
test("mechanical grouping finds trim/case/diacritics/hyphen-space candidates without aliases",()=>{
  assert.equal(textualKeys.lowercase(" AZUL MARINHO "),"azul marinho");
  assert.equal(textualKeys.diacriticInsensitive("Bordô"),textualKeys.diacriticInsensitive("Bordo"));
  assert.equal(textualKeys.separatorNormalized("azul-marinho"),textualKeys.separatorNormalized("azul marinho"));
  for(const value of ["Preto/Branco","Preto+Branco","Preto&Branco"])assert.equal(textualKeys.separatorNormalized(value),"preto branco");
  assert.notEqual(textualKeys.separatorNormalized("pink"),textualKeys.separatorNormalized("rosa"));
  const groups=analyzeColors(COLOR_FIXTURE).textualVariationCandidates;
  assert.ok(groups.find(g=>g.kind==="separatorNormalized")?.groups.every(g=>g.classification==="TEXTUAL_VARIATION_CANDIDATE"));
});
test("roundtrip stable, changed and collisions reuse current frontend helpers",()=>{
  assert.equal(transport("preto").stable,true);assert.equal(transport("preto").secondClickRemoves,true);
  for(const input of ["café","bordô","pink","azul marinho"])assert.equal(transport(input).stable,false);
  assert.equal(transport("café").secondClickRemoves,false);
  const result=analyzeColors(COLOR_FIXTURE).roundTripAnalysis;
  assert.equal(result.ROUNDTRIP_STABLE.distinctValues,4);assert.equal(result.ROUNDTRIP_CHANGED.distinctValues,3);
  assert.equal(result.collisionGroups,3);assert.equal(result.ROUNDTRIP_COLLISION.distinctValues,6);
  assert.equal(result.ROUNDTRIP_CHANGED.occurrences,16);
});
test("encoding preserves / + & initially; analyzer models CSV then existing reconstruction",()=>{
  assert.equal(transport("Preto/Branco").url,"cor=Preto%2FBranco");
  assert.equal(transport("Preto+Branco").url,"cor=Preto%2BBranco");
  assert.equal(transport("Preto&Branco").url,"cor=Preto%26Branco");
  assert.deepEqual(transport("preto,branco").backendValues,["preto","branco"]);
  assert.equal(transport("/").stable,false);
});
test("format/compound candidates retain exact raw values without semantic split",()=>{
  const values=[" Café ","Preto/Branco","Preto+Branco","Preto&Branco","A,B","A;B","(Cor40)","A  B","Preto e Branco","x".repeat(121)," ",""];
  const rows=values.map(value=>({source:"variant" as const,value,frequency:2,products:1,variants:2,merchants:1}));
  const analyzed=analyzeColors(rows);
  for(const key of ["diacritics","slash","plus","ampersand","comma","semicolon","parentheses","multipleWhitespace","leadingTrailingWhitespace","digits","veryLong"]){
    assert.ok(analyzed.formatMetrics[key].distinctValues>0,key);
  }
  assert.equal(analyzed.compoundColorCandidates.textualAnd.occurrences,2);
  assert.ok(analyzed.distribution.top.some(row=>row.value==="Preto/Branco"));
  assert.equal(analyzed.formatMetrics.leadingTrailingWhitespace.examples[0].value," Café ");
});
test("top and example limits, tail totals and null buckets are explicit",()=>{
  const rows=Array.from({length:151},(_,i)=>({source:"variant" as const,value:` Cor-${i} `,frequency:1,products:1,variants:1,merchants:1}));
  const analyzed=analyzeColors([...rows,{...rows[0],value:null}]);
  assert.equal(analyzed.distribution.top.length,100);assert.equal(analyzed.distribution.tailDistinctValues,51);
  assert.equal(analyzed.distribution.tailOccurrences,51);assert.equal(analyzed.distribution.nullBucket?.frequency,1);
  assert.equal(analyzed.formatMetrics.leadingTrailingWhitespace.examples.length,50);
  assert.equal(analyzed.roundTripAnalysis.ROUNDTRIP_CHANGED.examples.length,50);
});
test("exceeding distinct ceiling fails instead of silently misreporting complete collision counts",async()=>{
  const row=COLOR_FIXTURE[0];const f=fake({distribution:Array(q.DISTINCT_LIMIT+1).fill(row)});
  await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),/DISTINCT_LIMIT_EXCEEDED/);
  assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");
});
test("neutral merchant/provider/feed fixtures are passed through without partner-specific rules",async()=>{
  const f=fake();const report=await auditColors(environment,()=>f.client,async()=>{});
  assert.equal(report.merchantMetrics[0].name,"New Independent Shop");assert.equal(report.providerMetrics[0].name,"future-provider");
  assert.equal(report.feedMetrics[0].feed_id,"feed-new");assert.equal(report.merchantMetrics[0].topColors[0].value,"café");
  for(const sql of [q.GLOBAL_SQL,q.DISTRIBUTION_SQL,q.SCOPED_SQL,q.COMPARISON_SQL,q.FEED_SQL])assert.doesNotMatch(sql,/Dafiti|Lauri|Fanatics|awin/i);
});
test("output JSON contains required sections and is atomic, private, local /tmp only in tests",async()=>{
  const directory=await mkdtemp(join(tmpdir(),"uppulse-color-audit-test-"));
  try{
    const file=join(directory,"audit.json");const f=fake();await auditColors(environment,()=>f.client,report=>writeJsonAtomic(file,report));
    const report=JSON.parse(await readFile(file,"utf8"));
    for(const key of ["metadata","safety","schemaCapabilities","globalMetrics","merchantMetrics","providerMetrics","feedMetrics","variantColors","primaryColors","projectionColors","textualVariationCandidates","formatMetrics","compoundColorCandidates","variantProjectionComparison","roundTripAnalysis","unsupportedMetrics","warnings","timings"])assert.ok(key in report,key);
    assert.equal(report.safety.rollbackCompleted,true);assert.deepEqual(await readdir(directory),["audit.json"]);
  }finally{await rm(directory,{recursive:true});}
});
test("only output argument accepted, no arbitrary SQL or env-file flags; output failures sanitized",async()=>{
  assert.equal(outputPath([]),"/tmp/uppulse-filters-v3-colors-real-audit.json");
  assert.equal(outputPath(["--output=/tmp/colors.json"]),"/tmp/colors.json");
  for(const args of [["--sql=DELETE FROM products"],["--env-file=.env"],["--output="],["--output=/tmp/x.txt"],["--output=/tmp/x.json","--other=yes"]])assert.throws(()=>outputPath(args),/INVALID_ARGUMENTS/);
  const f=fake();await assert.rejects(auditColors(environment,()=>f.client,async()=>{throw Error("secret file failure");}),/OUTPUT_FAILED/);
  assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");
});
test("SQL uses confirmed normalized_colors, scoped sets and EXISTS rather than multiplying offer joins",()=>{
  assert.match(q.DISTRIBUTION_SQL,/SELECT DISTINCT c.product_id,c.merchant_id,color/);
  assert.match(q.DISTRIBUTION_SQL,/count\(DISTINCT p.id\)/);
  assert.match(q.COMPARISON_SQL,/FULL JOIN c USING\(product_id,merchant_id\)/);
  assert.match(q.AVAILABILITY_SQL,/EXISTS/);assert.match(q.AVAILABILITY_SQL,/o.provider_id=v.provider_id/);
  assert.doesNotMatch(q.AVAILABILITY_SQL,/JOIN offers/);
  for(const sql of [q.GLOBAL_SQL,q.DISTRIBUTION_SQL,q.SCOPED_SQL,q.SCOPED_TOP_SQL,q.COMPARISON_SQL,q.IMPACT_SQL,q.FEED_SQL])assert.doesNotMatch(sql,/\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXPLAIN|set_config)\b/i);
});

test("explicit URL config prevents driver credential fallbacks and timeout/search_path overrides",async()=>{
  const settings:ClientSettings={connectionString:"postgresql://read_only:synthetic@db.example.test/catalog?sslmode=require",statement_timeout:60_000,lock_timeout:2_000,connectionTimeoutMillis:10_000,application_name:"test",options:"-c search_path=pg_catalog,public"};
  const config=clientOptions(settings);
  assert.equal(config.host,"db.example.test");assert.equal(config.user,"read_only");assert.equal(config.database,"catalog");
  assert.equal(await config.password(),"synthetic");assert.equal("connectionString" in config,false);assert.equal(config.statement_timeout,60_000);
  const noPassword=clientOptions({...settings,connectionString:"postgresql://read_only@db.example.test/catalog"});
  assert.equal(await noPassword.password(),"");
  for(const connectionString of ["postgresql://db.example.test/catalog","postgresql://user@db.example.test","postgresql://u:p@db.example.test/catalog?options=unsafe","not-a-url"]) {
    assert.throws(()=>clientOptions({...settings,connectionString}),/INVALID_ARGUMENTS/);
  }
});

test("candidate/collision examples have a shared budget of 50 per category, not 50 per group",()=>{
  const rows=Array.from({length:75},(_,i)=>[`COLOR ${i}`,`color ${i}`]).flat().map(value=>({source:"projection" as const,value,frequency:1,products:1,variants:null,merchants:1}));
  const report=analyzeColors(rows);
  for(const category of report.textualVariationCandidates) {
    assert.ok(category.groups.reduce((n,g)=>n+g.examples.length,0)<=50);
  }
  assert.ok(report.roundTripAnalysis.collisions.reduce((n,g)=>n+g.examples.length,0)<=50);
  assert.equal(report.roundTripAnalysis.collisionGroups,75);
});

test("asynchronous client errors are consumed without leaking details and prevent successful output",async()=>{
  const f=fake();let listener:((error:unknown)=>void)|undefined;
  f.client.on=(_event,fn)=>{listener=fn;};
  const original=f.client.query.bind(f.client);
  f.client.query=async(sql,params)=>{
    const result=await original(sql,params);
    if(sql===q.FEED_SQL)listener?.(Error("postgres://u:private@secret-host/db"));
    return result;
  };
  await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),/AUDIT_OPERATION_FAILED/);
  assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");assert.equal(f.ends,1);
});


test("server defaults 2min/0 fail the guard without effective transaction-local configuration",async()=>{
  const f=fake({ignoreStatementTimeout:true,ignoreLockTimeout:true});
  await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),/TIMEOUT_GUARD_FAILED/);
  assert.deepEqual(f.guardTimeouts,[{statementTimeout:120_000,lockTimeout:0}]);
  assert.equal(f.calls.some(c=>c.sql===q.SCHEMA_SQL),false);
  assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");assert.equal(f.ends,1);
});
test("either ineffective timeout remains rejected independently before schema/data",async()=>{
  for(const options of [{ignoreStatementTimeout:true},{ignoreLockTimeout:true}]){
    const f=fake(options);
    await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),/TIMEOUT_GUARD_FAILED/);
    assert.equal(f.calls.some(c=>c.sql===q.SCHEMA_SQL),false);
    assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");assert.equal(f.ends,1);
  }
});
test("failure of either SET LOCAL aborts before guard/data and attempts rollback with sanitized error",async()=>{
  for(const failSql of ["SET LOCAL statement_timeout = '60000ms'","SET LOCAL lock_timeout = '2000ms'"]){
    const f=fake({failSql});
    await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),error=>{
      assert.equal(safeError(error),"AUDIT_OPERATION_FAILED");
      assert.equal(String(error).includes("password"),false);return true;
    });
    assert.equal(f.calls.some(c=>c.sql===q.GUARD_SQL||c.sql===q.SCHEMA_SQL),false);
    assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");assert.equal(f.ends,1);
  }
});


test("Supabase default search path must be replaced before the single bootstrap guard",async()=>{
  const f=fake({ignoreSearchPath:true});
  await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),/SEARCH_PATH_GUARD_FAILED/);
  assert.equal(f.calls.filter(c=>c.sql===q.GUARD_SQL).length,1);
  assert.equal(f.calls.some(c=>c.sql===q.SCHEMA_SQL),false);
  assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");assert.equal(f.ends,1);
});
test("unsafe resolved/configured paths including extensions, user and implicit temp abort",async()=>{
  for(const guard of [
    {search_schemas:["pg_catalog","public","extensions"],search_path_safe:false},
    {search_schemas:["pg_catalog","user_schema","public"],search_path_safe:false},
    {search_schemas:["pg_catalog","public"],search_path_safe:false},
    {search_schemas:["public","pg_catalog"],search_path_safe:false},
  ]){
    const f=fake({guard});
    await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),/SEARCH_PATH_GUARD_FAILED/);
    assert.equal(f.calls.some(c=>c.sql===q.SCHEMA_SQL),false);
    assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");assert.equal(f.ends,1);
  }
});
test("repeatable read isolation is verified before schema/data",async()=>{
  for(const isolation_level of ["read committed","serializable",undefined]){
    const f=fake({guard:{isolation_level}});
    await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),/ISOLATION_GUARD_FAILED/);
    assert.equal(f.calls.some(c=>c.sql===q.SCHEMA_SQL),false);
    assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");assert.equal(f.ends,1);
  }
});
test("SET LOCAL search_path failure aborts before any SELECT and rolls back",async()=>{
  const f=fake({failSql:"SET LOCAL search_path = pg_catalog, public"});
  await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),/AUDIT_OPERATION_FAILED/);
  assert.equal(f.calls.some(c=>/^(SELECT|WITH)\b/.test(c.sql)),false);
  assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");assert.equal(f.ends,1);
});
test("bootstrap SQL validates configured and resolved paths, including implicit schemas",()=>{
  assert.match(q.GUARD_SQL,/current_setting\('transaction_isolation'\)/);
  assert.match(q.GUARD_SQL,/current_setting\('search_path'\)/);
  assert.match(q.GUARD_SQL,/current_schemas\(false\) = ARRAY\['pg_catalog','public'\]::name\[\]/);
  assert.match(q.GUARD_SQL,/current_schemas\(true\) = ARRAY\['pg_catalog','public'\]::name\[\]/);
});


test("installed pg parser returns name[] as PostgreSQL text, unlike text[] and boolean",()=>{
  // PostgreSQL OIDs: name[]=1003, text[]=1009, bool=16, text=25. No connection needed.
  assert.equal(pgTypes.getTypeParser(1003,"text")("{pg_catalog,public}"),"{pg_catalog,public}");
  assert.deepEqual(pgTypes.getTypeParser(1009,"text")("{pg_catalog,public}"),["pg_catalog","public"]);
  assert.equal(pgTypes.getTypeParser(16,"text")("t"),true);
  assert.equal(pgTypes.getTypeParser(25,"text")("pg_catalog, public"),"pg_catalog, public");
});
test("real PostgreSQL name[] representation passes using the typed SQL boolean",async()=>{
  for(const schemas of ["{pg_catalog,public}",["pg_catalog","public"]]){
    const f=fake({guard:{search_path:"pg_catalog, public",search_schemas:schemas,
      schemas_false:schemas,schemas_true:schemas,search_path_safe:pgTypes.getTypeParser(16,"text")("t")}});
    await auditColors(environment,()=>f.client,async()=>{});
    assert.equal(f.calls[4].sql,q.GUARD_SQL);
    assert.equal(f.calls[5].sql,q.SCHEMA_SQL);
    assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");assert.equal(f.ends,1);
  }
});
test("typed SQL guard rejects extensions, user, extra schemas, reversed order and absent public",async()=>{
  for(const schemas of ["{pg_catalog,public,extensions}","{pg_catalog,user_schema,public}",
    '{pg_catalog,"$user",public}',"{pg_catalog,public,extra}","{public,pg_catalog}","{pg_catalog}"]){
    const f=fake({guard:{search_schemas:schemas,schemas_false:schemas,schemas_true:schemas,
      search_path_safe:pgTypes.getTypeParser(16,"text")("f")}});
    await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),/SEARCH_PATH_GUARD_FAILED/);
    assert.equal(f.calls.some(c=>c.sql===q.SCHEMA_SQL),false);
    assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");assert.equal(f.ends,1);
  }
});
test("safe-looking textual/array schemas never substitute for a missing or nonboolean SQL guard",async()=>{
  for(const search_path_safe of [undefined,null,"true","t",1,false]){
    const f=fake({guard:{search_schemas:"{pg_catalog,public}",search_path_safe}});
    await assert.rejects(auditColors(environment,()=>f.client,async()=>assert.fail()),/SEARCH_PATH_GUARD_FAILED/);
    assert.equal(f.calls.some(c=>c.sql===q.SCHEMA_SQL),false);
    assert.equal(f.calls.at(-1)?.sql,"ROLLBACK");assert.equal(f.ends,1);
  }
});
