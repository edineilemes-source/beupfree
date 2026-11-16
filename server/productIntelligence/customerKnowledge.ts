import type {FieldAssessment, TechnicalEvidence} from "./superCatalog";
import {evidenceAgreements} from "./technicalNormalization";

/** Deterministic consumer view: no generated claims, no majority-as-truth.
 * A short card is a display projection of auditable claims, not an AI rewrite.
 */
export type CustomerField={
 field:string; label:string; summary:string; status:FieldAssessment["status"];
 citations:{url:string;label:string}[];
 alternatives:number; evidenceCount:number;
};
export type CustomerKnowledge={summary:string;fields:CustomerField[];sources:{url:string;label:string}[];notice:string};
const names:Record<string,string>={
 drop:"Drop",altura_do_solado:"Altura do solado",peso:"Peso",entressola:"Entressola",
 cabedal:"Cabedal",solado:"Solado",amortecimento:"Amortecimento",
 indicacao_de_uso:"Indicação de uso",material:"Materiais",tecnologia:"Tecnologias",
 terreno:"Terreno",pisada:"Pisada",placa:"Placa",palmilha:"Palmilha",
 estabilidade:"Estabilidade",modalidade:"Modalidade",respirabilidade:"Respirabilidade",
 distancia_indicada:"Distância indicada",tipo_corrida:"Tipo de corrida"
};
const readable=(field:string)=>names[field]??field.replace(/_/g," ").replace(/^./,x=>x.toUpperCase());
function domain(url:string){
 try {return new URL(url).hostname.replace(/^www\./,"");}catch{return "Fonte";}
}
function preferred(s:TechnicalEvidence):number {
 return s.sourceType==="MANUFACTURER"?0:s.sourceType==="INDEPENDENT_TEST"?1:s.sourceType==="RETAILER"?2:3;
}
function citations(sources:TechnicalEvidence[],limit=2){
 const sorted=[...sources].sort((a,b)=>preferred(a)-preferred(b)||a.sourceUrl.localeCompare(b.sourceUrl));
 const unique=new Map<string,{url:string;label:string}>();
 for(const s of sorted){
  if(!unique.has(s.sourceUrl))unique.set(s.sourceUrl,{url:s.sourceUrl,label:domain(s.sourceUrl)});
 }
 return [...unique.values()].slice(0,limit);
}
const compact=(s:string,max=170)=>{
 const val=s.trim().replace(/\s+/g," ");
 return val.length>max?val.slice(0,max).replace(/\s+\S*$/,"").trimEnd()+"…":val;
};
function summarize(field:FieldAssessment):CustomerField|null {
 if(!field.sources?.length||field.status==="UNAVAILABLE")return null;
 const groups=evidenceAgreements(field.field,field.sources);
 if(!groups.length)return null;
 // Display all short numeric alternatives (e.g. 6–6.5 mm);
 // for prose show at most two differing claims, with the rest in the audit.
 const isMeasurement=field.field==="drop"||field.field==="altura_do_solado";
 let summary:string;
 if(groups.length===1) summary=compact(groups[0].value,220);
 else if(isMeasurement&&groups.length<=5)summary=groups.map(g=>g.value).join(" ou ");
 else summary=groups.slice(0,2).map(g=>compact(g.value,110)).join(" ou ")+(groups.length>2?" (mais "+(groups.length-2)+" versões nas fontes)":"");
 return {field:field.field,label:readable(field.field),summary,status:field.status,
  citations:citations(field.sources),alternatives:groups.length,evidenceCount:field.sources.length};
}
export function createCustomerKnowledge(fields:readonly FieldAssessment[]):CustomerKnowledge{
 const visible=fields.map(summarize).filter((x):x is CustomerField=>x!==null);
 const select=(key:string)=>visible.find(x=>x.field===key);
 const pieces:string[]=[];
 const usage=select("indicacao_de_uso");
 const midsole=select("entressola");
 const cushioning=select("amortecimento");
 if(usage&&usage.alternatives===1)pieces.push("Uso mencionado: "+usage.summary+".");
 if(midsole&&midsole.alternatives===1)pieces.push("Entressola: "+midsole.summary+".");
 else if(cushioning&&cushioning.alternatives===1)pieces.push("Amortecimento: "+cushioning.summary+".");
 const discrepant=visible.filter(f=>f.alternatives>1).length;
 const summary=pieces.length?pieces.join(" "):"As características a seguir foram reunidas a partir das fontes consultadas.";
 const all=new Map<string,{url:string;label:string}>();
 for(const field of fields)for(const s of field.sources??[]){
  if(!all.has(s.sourceUrl))all.set(s.sourceUrl,{url:s.sourceUrl,label:domain(s.sourceUrl)});
 }
 return {
  summary,fields:visible,sources:[...all.values()],
  notice:discrepant
   ? discrepant+" características possuem descrições ou medições diferentes entre as fontes. Os valores originais estão preservados na auditoria."
   :"Os dados refletem as fontes consultadas; confirme a variante e a numeração antes de comprar."
 };
}
