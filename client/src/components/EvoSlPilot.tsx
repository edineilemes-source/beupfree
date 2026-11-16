import {useState} from "react";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import type {KnowledgeCard} from "../../../server/productIntelligence/superCatalog";
type Pilot={pilot:true;pilotVersion:string;status:string;identity:{brand:string;model:string};card:KnowledgeCard;
 sources:Array<{name:string;url:string;type:string}>;metrics:{sourcePages:number;fields:number;verifiedFields:number;singleSourceFields:number;conflictingFields:number};
 narrative:string;warnings:string[]};
const statusLabel={VERIFIED:"Fontes concordam",SINGLE_SOURCE:"Uma fonte",CONFLICT:"Divergência entre fontes",UNAVAILABLE:"Não encontrado"} as const;
export default function EvoSlPilot(){
 const [data,setData]=useState<Pilot|null>(null);
 const [state,setState]=useState<"ready"|"loading"|"error">("ready");
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
