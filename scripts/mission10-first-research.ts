import { createLiveResearchProvider } from "../server/productIntelligence/liveProvider";
import { enrichProduct, type ResearchCache, type ResearchResult } from "../server/productIntelligence/research";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const identity = { masterId:"pilot-adidas-adizero-adios-pro-4",brand:"Adidas",model:"Adizero Adios Pro",version:"4" };
const openaiApiKey = process.env.OPENAI_API_KEY ?? "";
const tavilyApiKey = process.env.TAVILY_API_KEY ?? "";
if (!openaiApiKey || !tavilyApiKey) {
  console.error("MISSING_SECRETS: configure OPENAI_API_KEY and TAVILY_API_KEY in Codespaces and restart the Codespace.");
  process.exitCode=2;
} else {
  const provider=createLiveResearchProvider({openaiApiKey,tavilyApiKey,openaiModel:process.env.OPENAI_RESEARCH_MODEL});
  const cache:ResearchCache={get:async()=>null,set:async()=>{}};
  const result=await enrichProduct(identity,provider,cache,{maxSources:2,maxFieldsPerSource:12});
  const report={
    model:identity.brand+" "+identity.model+" "+identity.version,
    status:result.state,
    sourceCount:result.card.sourcesConsulted,
    warnings:result.warnings,
    fields:result.card.fields.filter(field=>field.status!=="UNAVAILABLE").map(field=>({
      field:field.field,value:field.value,status:field.status,
      sources:field.sources.map(source=>({url:source.sourceUrl,sourceType:source.sourceType}))
    }))
  };
  const dir=resolve("artifacts/mission10");
  await mkdir(dir,{recursive:true});
  const path=resolve(dir,"first-research.json");
  await writeFile(path,JSON.stringify(report,null,2)+"\n",{mode:0o600});
  console.log(JSON.stringify(report,null,2));
  console.log("Report: "+path);
  if (result.state==="RESEARCH_FAILED") process.exitCode=1;
}
