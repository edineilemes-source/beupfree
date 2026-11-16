import { createSuperCatalogCard, type IdentityDescriptor, type TechnicalEvidence } from "./superCatalog";

/** Controlled golden-data pilot. Manually transcribed excerpts from three public
 * pages. No live crawling, no paid APIs, no catalog writes, no fake product master.
 * URLs are exact source pages; this does not imply the data was extracted live.
 */
export const EVO_SL_PILOT_SOURCES=[
 {name:"adidas Brasil — KJ1363",url:"https://www.adidas.com.br/tenis-adizero-evo-sl/KJ1363.html",type:"MANUFACTURER" as const,modelCode:"KJ1363"},
 {name:"Centauro — EVO SL masculino",url:"https://www.centauro.com.br/tenis-masculino-adidas-adizero-evo-sl-996133.html",type:"RETAILER" as const},
 {name:"Netshoes — EVO SL masculino",url:"https://www.netshoes.com.br/p/tenis-adidas-adizero-evo-sl-masculino-preto%2Bbranco-FBA-83DK-026?promoted=true&sellerId=0",type:"RETAILER" as const},
] as const;
const identity:IdentityDescriptor={masterId:"pilot-evo-sl-not-a-commercial-master",brand:"Adidas",model:"Adizero Evo SL",manufacturerCode:undefined};
const observedAt="2026-11-16T12:00:00.000Z";
const evidence:TechnicalEvidence[]=[
 ["entressola","Lightstrike Pro",0],["drop","6 mm",0],["peso","224 g (código KJ1363)",0],
 ["cabedal","Têxtil e sintético",0],["solado","Borracha",0],["modalidade","Corrida",0],
 ["entressola","Lightstrike Pro",1],["cabedal","Mesh e sintético",1],["solado","Borracha",1],
 ["pisada","Neutra",1],["terreno","Asfalto e esteira",1],["tecnologia","Continental Better Rubber",1],
 ["drop","6 mm",2],["pisada","Neutra",2],["placa","Não possui",2],
 ["amortecimento","Muito macio (descrição comercial)",2],["terreno","Rua ou esteira",2],
 ["tecnologia","Lightstrike (descrição da loja)",2],
].map(([field,value,sourceIndex])=>{
 const s=EVO_SL_PILOT_SOURCES[Number(sourceIndex)];
 return {field:String(field),value:String(value),sourceUrl:s.url,sourceType:s.type,observedAt,
  ...("modelCode" in s?{modelCode:s.modelCode}:{})};
});
const card=createSuperCatalogCard(identity,evidence);
const reported=card.fields.filter(field=>field.status!=="UNAVAILABLE");
const stable=reported.filter(field=>field.status==="VERIFIED");
const single=reported.filter(field=>field.status==="SINGLE_SOURCE");
const conflicts=reported.filter(field=>field.status==="CONFLICT");
export function evoSlPilotResult(){
 return {
  pilot:true,pilotVersion:"11.2-golden-data-1",status:"PRE_EXTRACTED_NOT_LIVE",catalogSource:"pilot",
  identity,card,sources:EVO_SL_PILOT_SOURCES,
  metrics:{sourcePages:EVO_SL_PILOT_SOURCES.length,fields:reported.length,
   verifiedFields:stable.length,singleSourceFields:single.length,conflictingFields:conflicts.length},
  narrative:[
   "O adidas Adizero Evo SL é um tênis voltado à corrida, com entressola Lightstrike Pro e solado de borracha.",
   "A documentação reunida informa drop de 6 mm, mas o peso de 224 g está ligado ao código KJ1363 e não deve ser generalizado a outras versões.",
   "Os varejistas mencionam cabedal de malha/sintético, uso em asfalto/esteira e pisada neutra. As descrições sobre amortecimento e tecnologias nem sempre coincidem literalmente.",
  ].join(" "),
  warnings:[
   "Piloto com trechos selecionados manualmente de três páginas reais: ainda não valida busca/extracão automática.",
   "Fonte independente significa domínio distinto, não prova independência editorial entre varejistas.",
   "Peso e drop podem variar por versão, código e numeração; não transferir para outros SKUs.",
   "Não gravado no PostgreSQL e não associado ao Master do catálogo comercial.",
   "A classificação CONFLICT detecta divergência textual; pode incluir sinônimos e requer reconciliação posterior.",
  ],
 };
}
