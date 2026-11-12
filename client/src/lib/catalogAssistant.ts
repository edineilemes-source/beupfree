/** Consultor offline: interpretação transparente, sem chamadas a modelos externos. */
export type CatalogIntent = {brand?:string;activity?:string;priceMax?:number;size?:number;technical?:string[]};
export type CatalogRequest = {
  intent:CatalogIntent;
  mode:"new"|"refine";
  recognized:boolean;
  unsupported:string[];
};
const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const BRANDS:[RegExp,string][]=[
  [/\badidas\b/,"Adidas"],[/\bnike\b/,"Nike"],[/\bolympikus\b|\bolimpikus\b/,"Olympikus"],
  [/\basics\b/,"Asics"],[/\bmizuno\b/,"Mizuno"],[/\bpuma\b/,"Puma"],[/\bnew\s*balance\b/,"New Balance"],
  [/\bfila\b/,"Fila"],[/\bunder\s*armour\b/,"Under Armour"],[/\bskechers\b/,"Skechers"],
];
function extract(message:string):CatalogIntent{
  const text=normalize(message);
  const brand=BRANDS.find(([pattern])=>pattern.test(text))?.[1];
  const activity=/corr(er|ida)|maratona|\b\d+\s?km\b|esteira|jogging/.test(text)?"Corrida":
    /caminh(ar|ada)/.test(text)?"Caminhada":/\btrilh(a|as)\b/.test(text)?"Trilha":
    /basquet(e|ebol)/.test(text)?"Basquete":/futebol|futsal/.test(text)?"Futebol":
    /trein(o|ar)|academia|musculacao/.test(text)?"Treino":undefined;
  const price=/\b(?:ate|abaixo de|menos de|limite de|maximo|orcamento de)\s*(?:r\$\s*)?(\d{2,5})(?:[.,]\d{2})?\b/.exec(text);
  const size=/\b(?:numero|numeracao|calco|tamanho)\s*(\d{2})\b/.exec(text);
  const priceMax=price?Number(price[1]):undefined;
  const technical=[
    [/amortec/,"amortecimento"],[/maci[oa]|maciez/,"maciez"],[/confort/,"conforto"],
    [/cabedal/,"cabedal"],[/\bdrop\b/,"drop"],[/solado/,"solado"],[/material/,"material"],
  ].filter(([pattern])=>(pattern as RegExp).test(text)).map(([,token])=>token as string);
  return {brand,activity,priceMax:priceMax&&priceMax>0?priceMax:undefined,size:size?Number(size[1]):undefined,
    ...(technical.length?{technical}: {})};
}
export const hasCatalogIntent=(value:CatalogIntent)=>Boolean(value.brand||value.activity||value.priceMax||value.size||value.technical?.length);
export function parseCatalogIntent(message:string,previous:CatalogIntent={}):CatalogIntent {
  return {...previous,...Object.fromEntries(Object.entries(extract(message)).filter(([,v])=>v!==undefined))};
}
export function interpretCatalogRequest(message:string,previous:CatalogIntent={}):CatalogRequest {
  const text=normalize(message);
  const found=extract(message);
  const recognized=hasCatalogIntent(found);
  const explicitNew=/\b(nova (?:busca|pesquisa)|comecar de novo|do zero|outra busca|esqueca os filtros|limpar filtros)\b/.test(text);
  const explicitRefine=/\b(refin(ar|e)|mantendo|mesma busca|mesmos filtros|tambem|continue|so mudar|troque apenas)\b/.test(text);
  // A troca de marca/modalidade é tratada como nova pesquisa por padrão.
  // Uma mensagem contendo somente preço/numeração refina a consulta atual.
  const onlyRestrictions=!found.brand&&!found.activity&&Boolean(found.priceMax||found.size||found.technical?.length);
  const mode:CatalogRequest["mode"]=!explicitNew&&(explicitRefine||onlyRestrictions)?"refine":"new";
  const base=mode==="refine"?previous:{};
  const intent:CatalogIntent={...base,...Object.fromEntries(Object.entries(found).filter(([,v])=>v!==undefined))};
  if(mode==="refine"&&found.technical?.length) intent.technical=[...new Set([...(base.technical??[]),...found.technical])];
  if (/\b(qualquer marca|sem marca|todas as marcas)\b/.test(text))delete intent.brand;
  if (/\b(qualquer modalidade|sem modalidade|qualquer uso)\b/.test(text))delete intent.activity;
  if (/\b(sem limite|sem orcamento|qualquer preco|sem teto de preco)\b/.test(text))delete intent.priceMax;
  if (/\b(qualquer numero|qualquer tamanho|sem tamanho)\b/.test(text))delete intent.size;
  const unsupported:string[]=[];
  if(intent.activity==="Trilha")unsupported.push("A modalidade trilha ainda não possui filtro operacional específico.");
  return {intent,mode,recognized:recognized||explicitNew||(/\b(qualquer marca|sem marca|todas as marcas|qualquer modalidade|sem modalidade|qualquer uso|sem limite|qualquer preco|qualquer tamanho)\b/.test(text)&&hasCatalogIntent(previous)),unsupported};
}
export function catalogAssistantParams(intent:CatalogIntent){
  const p=new URLSearchParams({limit:"6",offset:"0",sort:"recommended"});
  if(intent.brand)p.set("marca",intent.brand);
  if(intent.activity&&intent.activity!=="Trilha")p.set("modalidade",intent.activity);
  if(intent.priceMax)p.set("priceMax",String(intent.priceMax));
  if(intent.size)p.set("tamanho",String(intent.size));
  if(intent.technical?.length)p.set("tecnica",intent.technical.join(","));
  return p;
}
export function catalogFilterLabels(intent:CatalogIntent):string[]{
  return [
    intent.brand?"Marca: "+intent.brand:null,
    intent.activity?"Modalidade: "+intent.activity:null,
    intent.priceMax?"Preço máximo: R$ "+intent.priceMax:null,
    intent.size?"Tamanho: "+intent.size:null,
    intent.technical?.length?"Evidências técnicas: "+intent.technical.join(", "):null,
  ].filter((label):label is string=>Boolean(label));
}
export function assistantExplanation(intent:CatalogIntent,_product:{mainName:string;activities?:string[];bestOffer?:{currentPrice?:string|number;discountPercent?:number}}){
  const criteria=catalogFilterLabels(intent);
  return "Oferta do catálogo operacional"+(criteria.length?" encontrada pelos filtros "+criteria.join("; "):"")+
    ". Classificação comercial, sem avaliação técnica independente.";
}
