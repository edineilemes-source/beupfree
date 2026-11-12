/** Offline catalog-intent parser. No model calls, telemetry, or external requests. */
export type CatalogIntent = { brand?: string; activity?: string; priceMax?: number; size?: number };
const BRANDS: [RegExp,string][] = [
  [/\badidas\b/i,"Adidas"], [/\bnike\b/i,"Nike"], [/\bolympikus\b|\bolimpikus\b/i,"Olympikus"],
  [/\basics\b/i,"Asics"], [/\bmizuno\b/i,"Mizuno"], [/\bpuma\b/i,"Puma"], [/\bnew\s*balance\b/i,"New Balance"],
  [/\bfila\b/i,"Fila"], [/\bunder\s*armour\b/i,"Under Armour"], [/\bskechers\b/i,"Skechers"],
];
export function parseCatalogIntent(message:string, previous:CatalogIntent={}):CatalogIntent {
  const text=message.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const brand=BRANDS.find(([pattern])=>pattern.test(text))?.[1]??previous.brand;
  const activity=/corr(er|ida)|maratona|5\s?km|10\s?km|esteira|jogging/.test(text)?"Corrida":/caminh(ar|ada)/.test(text)?"Caminhada":/trilh(a|as)/.test(text)?"Trilha":/basquet(e|ebol)/.test(text)?"Basquete":/futebol|futsal/.test(text)?"Futebol":/trein(o|ar)|academia|musculacao/.test(text)?"Treino":previous.activity;
  const price=/\b(?:ate|abaixo de|menos de|limite de|maximo|orcamento de)\s*(?:r\$\s*)?(\d{2,5})(?:[.,]\d{2})?\b/.exec(text);
  const size=/\b(?:numero|numeracao|calco|tamanho)\s*(\d{2})\b/.exec(text);
  const priceMax=price?Number(price[1]):previous.priceMax;
  return {brand,activity,priceMax:priceMax&&priceMax>0?priceMax:undefined,size:size?Number(size[1]):previous.size};
}
export function catalogAssistantParams(intent:CatalogIntent) {
  const p=new URLSearchParams({limit:"6",offset:"0",sort:"recommended"});
  if(intent.brand)p.set("marca",intent.brand);
  if(intent.activity && intent.activity!=="Trilha")p.set("modalidade",intent.activity);
  if(intent.priceMax)p.set("priceMax",String(intent.priceMax));
  if(intent.size)p.set("tamanho",String(intent.size));
  return p;
}
export function assistantExplanation(intent:CatalogIntent, product:{mainName:string;activities?:string[];bestOffer?:{currentPrice?:string|number;discountPercent?:number}}){
  const criteria=[];
  if(intent.brand)criteria.push("marca "+intent.brand);
  if(intent.activity)criteria.push("modalidade "+intent.activity.toLowerCase());
  if(intent.priceMax)criteria.push("até R$ "+intent.priceMax);
  if(intent.size)criteria.push("numeração "+intent.size);
  return "Encontrado no catálogo publicável"+(criteria.length?" com filtros de "+criteria.join(", "):"")+". A ordem utiliza a classificação do catálogo, não uma avaliação técnica independente.";
}
