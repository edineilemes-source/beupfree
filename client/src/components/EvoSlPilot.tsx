import {useState} from "react";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import IntelligentProductCard from "./IntelligentProductCard";
import type {KnowledgeCard} from "../../../server/productIntelligence/superCatalog";
type Pilot={pilot:true;pilotVersion:string;status:string;identity:{brand:string;model:string};card:KnowledgeCard;
 sources:Array<{name:string;url:string;type:string}>;metrics:{sourcePages:number;fields:number;verifiedFields:number;singleSourceFields:number;conflictingFields:number};
 narrative:string;warnings:string[]};
type LiveReport={live:true;reconciled?:{metrics:{fields:number;verified:number;conflicts:number;conflictsWithMajority:number};fields:KnowledgeCard["fields"]};qualityGate?:boolean;metrics?:{fields:number;verified:number;conflicts:number;domainsWithEvidence:number};perSource?:Array<{url:string;extracted:number;fields:string[]}>;started:string;finished:string;status:string;searchProvider:string;extractionProvider:string;requestsReserved:{tavily:number;openai:number};sourceCount:number;distinctDomains:number;searchedSources:Array<{url:string;title:string}>;fields:Array<{field:string;value:string|null;status:"VERIFIED"|"SINGLE_SOURCE"|"CONFLICT";sources:Array<{url:string;value:string}>}>;warnings:string[];limitations:string[]};
const statusLabel={VERIFIED:"Fontes concordam",SINGLE_SOURCE:"Uma fonte",CONFLICT:"Divergência entre fontes",UNAVAILABLE:"Não encontrado"} as const;
export default function EvoSlPilot(){
 const [data,setData]=useState<Pilot|null>(null);
 const [state,setState]=useState<"ready"|"loading"|"error">("ready");
 const [live,setLive]=useState<LiveReport|null>(null);
 const [liveVersion,setLiveVersion]=useState<"v1"|"v2">("v1");
 const [liveState,setLiveState]=useState<"idle"|"loading"|"not-run"|"error">("idle");
 async function readLive(version:"v1"|"v2"="v1"){
  setLiveVersion(version);
  setLiveState("loading");
  try{
   const response=await fetch(version==="v2"?"/api/product-knowledge/pilot/live-evo-sl-v2":"/api/product-knowledge/pilot/live-evo-sl",{cache:"no-store"});
   if(response.status===404){setLive(null);setLiveState("not-run");return;}
   if(!response.ok)throw Error("LIVE_RESEARCH_UNAVAILABLE");
   const body:LiveReport=await response.json();
   if(!body.live||!Array.isArray(body.fields))throw Error("INVALID_REPORT");
   setLive(body);setLiveState("idle");
  }catch{setLiveState("error");}
 }
 async function run(){
  setState("loading");
  try{
   const res=await fetch("/api/product-knowledge/pilot/evo-sl");
   if(!res.ok)throw Error("PILOT_UNAVAILABLE");
   const body:Pilot=await res.json();
   if(!body.pilot||body.status!=="PRE_EXTRACTED_NOT_LIVE")throw Error("UNEXPECTED_PILOT");
   setData(body);setState("ready");
  }catch{setState("error");}
 }
 const fields=data?.card.fields.filter(f=>f.status!=="UNAVAILABLE")??[];
 return <section className="space-y-3 rounded-md border p-3" data-testid="evo-sl-pilot">
  <div className="flex flex-wrap items-center gap-2">
   <strong>Laboratório da ficha técnica</strong>
   <Badge variant="outline">Piloto sem custo</Badge>
  </div>
  <p className="text-xs text-muted-foreground">Demonstração independente do produto que você abriu. Usa dados pré-extraídos de três páginas públicas do Adidas Adizero Evo SL. Não pesquisa a internet neste clique e não grava no catálogo.</p>
  <Button type="button" variant="outline" onClick={()=>void run()} disabled={state==="loading"} data-testid="run-evo-sl-pilot">
   {state==="loading"?"Preparando comparação…":"Testar ficha Evo SL — 3 fontes"}
  </Button>
  <div className="space-y-2 rounded border p-3">
   <strong>Pesquisa real com Tavily + OpenAI</strong>
   <p className="text-xs text-muted-foreground">As pesquisas reais são executadas no terminal com limite de chamadas. Estes botões só consultam relatórios existentes, sem consumir créditos.</p>
   <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" data-testid="read-evo-sl-live" disabled={liveState==="loading"} onClick={()=>void readLive("v1")}>Ver IA real — rodada 1</Button>
   <Button type="button" variant="outline" data-testid="read-evo-sl-live-v2" disabled={liveState==="loading"} onClick={()=>void readLive("v2")}>Ver IA real — rodada 2</Button></div>
   {liveState==="not-run"&&<p role="status">Ainda não há relatório da rodada {liveVersion==="v1"?"1":"2"} nesta instância. O botão não faz chamadas pagas.</p>}
   {liveState==="error"&&<p role="alert">Falha ao consultar o relatório da pesquisa real.</p>}
   {live&&<div className="space-y-2" data-testid="evo-sl-live-results">
    <p><strong>Resultado da pesquisa real:</strong> {live.status} · {live.sourceCount} fonte(s) com evidências · {live.distinctDomains} domínio(s) pesquisados</p>
    {live.metrics&&<p className="text-xs">Qualidade: {live.metrics.verified} campos com concordância · {live.metrics.conflicts} conflitos · {live.metrics.domainsWithEvidence} domínios úteis. Critério mínimo: {live.qualityGate?"atingido":"não atingido"}.</p>}
    {live.perSource&&<ul className="text-xs list-disc list-inside">{live.perSource.map(s=><li key={s.url}>{new URL(s.url).hostname}: {s.extracted} campos extraídos</li>)}</ul>}
    {live.sourceCount<2&&<p role="status" className="font-medium">Ficha ainda não aprovada: é necessário obter evidências técnicas de pelo menos duas fontes independentes. O status ENRICHED indica extração realizada, não validação de qualidade.</p>}
    <p className="text-xs">Chamadas: Tavily {live.requestsReserved.tavily}; OpenAI {live.requestsReserved.openai}. Pesquisa realizada em {new Date(live.finished).toLocaleString("pt-BR")}.</p>
    {live.reconciled&&<section className="space-y-2 rounded border p-3" data-testid="evo-sl-reconciled">
      <h4 className="font-semibold">Conciliação técnica — sem novas chamadas pagas</h4>
      <p className="text-xs">Padronização conservadora de medidas. Valores de fontes diferentes continuam separados quando há divergência; uma maioria não é tratada como verdade definitiva.</p>
      <p className="text-xs">{live.reconciled.metrics.verified} campos concordantes integralmente · {live.reconciled.metrics.conflicts} conflitos restantes · {live.reconciled.metrics.conflictsWithMajority} conflitos com maioria parcial.</p>
      {live.reconciled.fields.map(field=><article key={field.field} className="space-y-1 rounded border p-2 text-xs">
       <strong>{field.field.replace(/_/g," ")} — {field.status==="VERIFIED"?"Concordância":"SINGLE_SOURCE"===field.status?"Uma fonte":"Divergência preservada"}</strong>
       {field.agreements.map(group=><p key={group.value}>• {group.value} — {group.count} fonte(s)</p>)}
      </article>)}
     </section>}
    {liveVersion==="v2"&&live.reconciled&&<IntelligentProductCard brand="Adidas" model="Adizero Evo SL" fields={live.reconciled.fields} experimental/>}
    <details className="rounded border p-2" data-testid="live-research-technical-diagnostics"><summary className="cursor-pointer font-semibold">Detalhes da pesquisa e extração original</summary>
    <h4 className="font-semibold">Fontes retornadas pela Tavily</h4>
    <ul className="list-inside list-disc text-xs">{live.searchedSources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="underline break-words">{s.title||s.url}</a></li>)}</ul>
    <h4 className="font-semibold">Informações extraídas pela OpenAI</h4>
    {live.fields.length===0&&<p>Não houve atributos técnicos extraídos com evidências suficientes.</p>}
    {live.fields.map(field=><article key={field.field} className="rounded border p-2 text-sm">
      <strong>{field.field.replace(/_/g," ")}:</strong> {field.value??"Valores divergentes"}
      <p className="text-xs">{statusLabel[field.status]}</p>
      {field.sources.map(source=><p key={source.url+source.value} className="text-xs break-words">{source.value} — <a href={source.url} className="underline" target="_blank" rel="noopener noreferrer">{new URL(source.url).hostname}</a></p>)}
    </article>)}
    </details>
    {live.warnings.map((warning,i)=><p key={i} className="text-xs">Aviso: {warning}</p>)}
    {live.limitations.map((limitation,i)=><p key={i} className="text-xs text-muted-foreground">{limitation}</p>)}
   </div>}
  </div>
  {state==="error"&&<p role="alert">Piloto indisponível. Confirme que está no ambiente de desenvolvimento atualizado.</p>}
  {data&&<div className="space-y-3" data-testid="evo-sl-pilot-results">
   <h3 className="font-semibold">{data.identity.brand} {data.identity.model} — ficha experimental</h3>
   <p className="text-xs">Origem: conteúdo pré-extraído, sem extração automática e sem persistência. SuperHash de laboratório: <code className="break-all">{data.card.superHash}</code></p>
   <div className="grid grid-cols-2 gap-2 text-xs">
    <p><strong>{data.metrics.sourcePages}</strong> páginas de referência</p>
    <p><strong>{data.metrics.fields}</strong> características identificadas</p>
    <p><strong>{data.metrics.verifiedFields}</strong> campos com concordância</p>
    <p><strong>{data.metrics.conflictingFields}</strong> campos com divergências</p>
   </div>
   <div className="rounded border p-3"><strong>Síntese experimental</strong><p className="mt-1">{data.narrative}</p></div>
   <h4 className="font-semibold">Características e evidências</h4>
   <div className="space-y-2">{fields.map(field=><article key={field.field} className="rounded border p-2">
    <p><strong>{field.field.replace(/_/g," ")}:</strong> {field.value??"Há informações diferentes entre fontes"}</p>
    <p className="text-xs">{statusLabel[field.status]} · {field.sources.length} referência(s)</p>
    <ul className="list-inside list-disc text-xs">{field.sources.map(s=><li key={s.sourceUrl+s.field+s.value} className="break-words">
     {s.value} — <a className="underline" href={s.sourceUrl} target="_blank" rel="noopener noreferrer">{new URL(s.sourceUrl).hostname}</a>
    </li>)}</ul>
   </article>)}</div>
   <h4 className="font-semibold">Fontes públicas usadas na preparação</h4>
   <ul className="list-inside list-disc">{data.sources.map(s=><li key={s.url}><a href={s.url} className="underline break-words" rel="noopener noreferrer" target="_blank">{s.name}</a></li>)}</ul>
   <h4 className="font-semibold">Limites do teste</h4>
   <ul className="list-inside list-disc text-xs text-muted-foreground">{data.warnings.map(w=><li key={w}>{w}</li>)}</ul>
  </div>}
 </section>;
}
