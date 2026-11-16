import {createSuperCatalogCard,type TechnicalEvidence} from "./superCatalog";
import {TECHNICAL_FIELD_SET} from "./technicalFields";
type Source={url:string;value:string;sourceType?:string;observedAt?:string};
type Field={field:string;sources:Source[]};
type Report={fields:Field[]};
export function reconcileLiveReport(report:Report){
 const evidence:TechnicalEvidence[]=[];
 for(const field of report.fields??[]){
  if(!TECHNICAL_FIELD_SET.has(field.field)||!Array.isArray(field.sources))continue;
  for(const source of field.sources){
   if(typeof source.value!=="string"||typeof source.url!=="string")continue;
   evidence.push({field:field.field,value:source.value,sourceUrl:source.url,
     sourceType:(["MANUFACTURER","RETAILER","INDEPENDENT_TEST","FEED"].includes(source.sourceType??"")?source.sourceType:"RETAILER") as TechnicalEvidence["sourceType"],observedAt:source.observedAt??"2026-11-16T00:00:00Z"});
  }
 }
 const card=createSuperCatalogCard({masterId:"pilot-evo-sl-reconciled-v2",brand:"Adidas",model:"Adizero Evo SL"},evidence);
 const fields=card.fields.filter(f=>f.status!=="UNAVAILABLE").map(f=>({
  field:f.field,status:f.status,value:f.value,agreements:f.agreements??[],sources:f.sources
 }));
 return {fields,metrics:{
  fields:fields.length,verified:fields.filter(f=>f.status==="VERIFIED").length,
  conflicts:fields.filter(f=>f.status==="CONFLICT").length,
  conflictsWithMajority:fields.filter(f=>f.status==="CONFLICT"&&(f.agreements?.[0]?.count??0)>=2).length
 }};
}
