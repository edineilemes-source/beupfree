import {mkdir,writeFile} from "node:fs/promises";
import {createLiveResearchProvider} from "../server/productIntelligence/liveProvider";
import {enrichProduct,type ResearchProvider,type ResearchHit} from "../server/productIntelligence/research";
import {rankTechnicalSources} from "../server/productIntelligence/sourceSelection";
import {createSuperCatalogCard,type TechnicalEvidence} from "../server/productIntelligence/superCatalog";

/** Version 2. Only one model. Two Tavily searches, up to three OpenAI calls.
 * CLI must be explicitly invoked. Keeps original version 1 result unchanged.
 * No catalog writes or externally accessible paid endpoint.
 */
if(!process.argv.includes("--execute")){
 console.error("NOT_AUTHORIZED: use dedicated controlled one-shot runner.");
 process.exit(2);
}
if(!process.env.TAVILY_API_KEY||!process.env.OPENAI_API_KEY){
 console.error("MISSING_CREDENTIALS: set Codespaces secrets; do not paste credentials into chat.");
 process.exit(2);
}
const identity={masterId:"pilot-evo-sl-live-v2",brand:"Adidas",model:"Adizero Evo SL"};
const output="/tmp/uppulse-evo-sl-real-research-v2.json";
const requests={tavily:0,openai:0};
const allowance={tavily:2,openai:3};
const provider=createLiveResearchProvider({
 tavilyApiKey:process.env.TAVILY_API_KEY,openaiApiKey:process.env.OPENAI_API_KEY,
 openaiModel:process.env.OPENAI_RESEARCH_MODEL||"gpt-4o-mini",
 oneShotPilotBudget:{async reserve(operation){
  if(requests[operation]>=allowance[operation])throw Error("RESEARCH_BUDGET_EXHAUSTED");
  requests[operation]++;
 }},
});
const trace:{url:string;title:string;score:number;reason:string;query:string}[]=[];
const perSource:{url:string;extracted:number;fields:string[]}[]=[];
const selected:ResearchHit[]=[];
const searchQueries=[
 '"Adidas Adizero Evo SL" specifications midsole drop weight outsole upper retailer',
 '"Adidas Adizero EVO SL" review technical specs mesh cushioning running heel stack',
];
const adapter:ResearchProvider={
 async search(_query,_limit,signal){
  const all:ResearchHit[]=[];
  for(const q of searchQueries){
   try{
    const found=await provider.search(q,10,signal);
    all.push(...found);
    const ranked=rankTechnicalSources(found,identity,10);
    trace.push(...ranked.candidates.map(c=>({url:c.hit.url,title:c.hit.title,score:c.score,reason:c.reason,query:q})));
   }catch(error){
    // Do not repeat paid requests or silently conceal a failed provider call.
    if(!all.length)throw error;
    trace.push({url:"",title:"SECOND_SEARCH_FAILED",score:-999,reason:"SEARCH_ERROR",query:q});
   }
  }
  const ranked=rankTechnicalSources(all,identity,3);
  selected.push(...ranked.selected);
  return ranked.selected;
 },
 async extract(product,hit,signal):Promise<TechnicalEvidence[]>{
  const evidence=await provider.extract(product,hit,signal);
  perSource.push({url:hit.url,extracted:evidence.length,fields:evidence.map(x=>x.field)});
  return evidence;
 }
};
const started=new Date().toISOString();
const result=await enrichProduct(identity,adapter,{get:async()=>null,set:async()=>{}},
 {maxSources:3,maxFieldsPerSource:20,timeoutMs:120000});
const fields=result.card.fields.filter(f=>f.status!=="UNAVAILABLE");
const sourcesWithEvidence=new Set(fields.flatMap(f=>f.sources.map(s=>new URL(s.sourceUrl).hostname.replace(/^www\./,""))));
const verifiedFields=fields.filter(f=>f.status==="VERIFIED");
const qualityGate=sourcesWithEvidence.size>=2&&verifiedFields.length>=1;
const report={
 pilot:"EVO_SL_LIVE_RESEARCH_V2",live:true,started,finished:new Date().toISOString(),
 status:result.state,qualityGate,requestsReserved:requests,
 product:{brand:identity.brand,model:identity.model,masterId:identity.masterId,superHash:createSuperCatalogCard(identity).superHash},
 searchProvider:"Tavily",extractionProvider:"OpenAI",searchQueries,
 searchedSources:selected.map(s=>({url:s.url,title:s.title,sourceType:s.sourceType})),
 candidateSources:trace,perSource,
 sourceCount:result.card.sourcesConsulted,distinctDomains:new Set(selected.map(s=>new URL(s.url).hostname.replace(/^www\./,""))).size,sourceDomainsWithEvidence:sourcesWithEvidence.size,
 fields:fields.map(f=>({field:f.field,value:f.value,status:f.status,
  sources:f.sources.map(s=>({url:s.sourceUrl,value:s.value,sourceType:s.sourceType,observedAt:s.observedAt}))})),
 metrics:{candidateResults:trace.length,selectedPages:selected.length,fields:fields.length,verified:verifiedFields.length,
  conflicts:fields.filter(f=>f.status==="CONFLICT").length,domainsWithEvidence:sourcesWithEvidence.size},
 warnings:result.warnings,
 limitations:["Tavily provides indexed excerpts, not necessarily complete pages.",
  "Code/variant differences require review before a commercial master is enriched.",
  "No catalog database writes; quality gate requires two domains with evidence and one verified field."]
};
await mkdir("/tmp",{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+"\n",{mode:0o600});
console.log(JSON.stringify({report:output,status:report.status,qualityGate,requestsReserved:requests,
 metrics:report.metrics,perSource:report.perSource,warnings:report.warnings},null,2));
if(!qualityGate)process.exitCode=1;
