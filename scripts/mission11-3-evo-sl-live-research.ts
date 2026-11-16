import {writeFile,mkdir} from "node:fs/promises";
import {dirname} from "node:path";
import {createLiveResearchProvider} from "../server/productIntelligence/liveProvider";
import {enrichProduct,type ResearchProvider,type ResearchHit} from "../server/productIntelligence/research";
import {pickIndependentSources} from "../server/productIntelligence/sourceSelection";
import {createSuperCatalogCard} from "../server/productIntelligence/superCatalog";

/** Real, strictly opt-in, one-model pilot. No catalog/DB writes, no public API.
 * One Tavily request + up to three OpenAI extractions. Estimated API cost varies.
 */
const identity={masterId:"pilot-evo-sl-live-2026-11",brand:"Adidas",model:"Adizero Evo SL"};
const output="/tmp/uppulse-evo-sl-real-research.json";
const confirm=process.argv.includes("--execute");
if(!confirm) {
 console.error("MODO_SEGURO: use --execute para autorizar até 1 chamada Tavily e 3 chamadas OpenAI reais, sujeitas a cobrança.");
 process.exit(2);
}
if(!process.env.TAVILY_API_KEY || !process.env.OPENAI_API_KEY) {
 console.error("CREDENTIALS_NOT_CONFIGURED: faltam TAVILY_API_KEY e/ou OPENAI_API_KEY no terminal Codespaces (não cole chaves no chat).");
 process.exit(2);
}
const counters={tavily:0,openai:0};
const maxima={tavily:1,openai:3};
const budget={
 async reserve(operation:"tavily"|"openai"){
  if(counters[operation]>=maxima[operation])throw Error("RESEARCH_BUDGET_EXHAUSTED");
  counters[operation]++;
 }
};
const provider=createLiveResearchProvider({
 tavilyApiKey:process.env.TAVILY_API_KEY,
 openaiApiKey:process.env.OPENAI_API_KEY,
 openaiModel:process.env.OPENAI_RESEARCH_MODEL||"gpt-4o-mini",
 oneShotPilotBudget:budget,
});
const modelMatches=(hit:ResearchHit)=>{
 const match=(hit.title+" "+hit.snippet).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 return /adizero/.test(match)&&/\bevo\s*-?\s*sl\b/.test(match);
};
const searched:ResearchHit[]=[];
const candidates:{url:string;title:string;eligible:boolean}[]=[];
const adapted:ResearchProvider={
 async search(query,limit,signal){
  const hits=await provider.search(query,5,signal);
  for(const hit of hits)candidates.push({url:hit.url,title:hit.title,eligible:modelMatches(hit)});
  const filtered=pickIndependentSources(hits.filter(modelMatches),Math.min(3,limit));
  searched.push(...filtered);
  return filtered;
 },
 extract:provider.extract,
};
const none={async get(_key:string){return null;},async set(_key:string,_result:unknown){/* intentionally do not save commercial cache */}};
const started=new Date().toISOString();
const result=await enrichProduct(identity,adapted,none,{maxSources:3,maxFieldsPerSource:20,timeoutMs:120000});
const evaluated=result.card.fields.filter(field=>field.status!=="UNAVAILABLE");
const report={
 pilot:"EVO_SL_LIVE_RESEARCH_V1",live:true,
 started,finished:new Date().toISOString(),
 product:{brand:identity.brand,model:identity.model,masterId:identity.masterId,superHash:createSuperCatalogCard(identity).superHash},
 status:result.state,
 searchProvider:"Tavily",extractionProvider:"OpenAI",model:process.env.OPENAI_RESEARCH_MODEL||"gpt-4o-mini",
 requestsReserved:counters,sourceCount:result.card.sourcesConsulted,
 distinctDomains:new Set(searched.map(hit=>new URL(hit.url).hostname.replace(/^www\./,""))).size,
 targetSources:3,
 searchedSources:searched.map(hit=>({url:hit.url,title:hit.title,sourceType:hit.sourceType})),
 candidateSources:candidates,
 fields:evaluated.map(field=>({
  field:field.field,value:field.value,status:field.status,
  sources:field.sources.map(s=>({url:s.sourceUrl,value:s.value,type:s.sourceType,observedAt:s.observedAt}))
 })),
 warnings:result.warnings,
 limitations:[
  "Resultado de APIs reais, mas a Tavily fornece trechos indexados; não é acesso direto ao HTML dos sites.",
  "Fontes distintas são domínios diferentes; a correspondência de versão e de código exige revisão.",
  "Sem escrita no catálogo, sem merge de Masters, sem publicação em produção.",
 ],
};
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+"\n",{mode:0o600});
console.log(JSON.stringify({report:output,status:report.status,requestsReserved:counters,sourceCount:report.sourceCount,
 distinctDomains:report.distinctDomains,fields:report.fields.length,verified:report.fields.filter(f=>f.status==="VERIFIED").length,
 conflicts:report.fields.filter(f=>f.status==="CONFLICT").length,warnings:report.warnings},null,2));
if(result.state!=="ENRICHED"||!evaluated.length||result.card.sourcesConsulted<2)
 process.exitCode=1;
