import type { ResearchHit } from "./research";

export function pickIndependentSources(hits: readonly ResearchHit[], limit = 3): ResearchHit[] {
  const seen = new Set<string>();
  const selected: ResearchHit[] = [];
  for (const hit of hits) {
    let host: string;
    try {
      const url = new URL(hit.url);
      if (url.protocol !== "https:" || url.username || url.password) continue;
      host = url.hostname.toLowerCase().replace(/^www\./, "");
    } catch { continue; }
    if (seen.has(host)) continue;
    seen.add(host);
    selected.push(hit);
    if (selected.length >= limit) break;
  }
  return selected;
}

export type ResearchCoverage = {
  selectedSources: number;
  targetSources: number;
  distinctDomains: number;
  meetsTarget: boolean;
};
export function researchCoverage(hits: readonly ResearchHit[], targetSources = 3): ResearchCoverage {
  const independent = pickIndependentSources(hits, targetSources);
  return {selectedSources: independent.length,targetSources,distinctDomains: independent.length,meetsTarget: independent.length>=targetSources};
}

/** Ranking for technical research; does not establish truth or product identity.
 * Prefer detailed independent technical pages over videos and corporate pages.
 * Only distinct registrable hosts (www stripped) count as independent candidates.
 */
const irrelevantHosts = /(^|\.)(youtube\.com|youtu\.be|tavily\.com|facebook\.com|instagram\.com|tiktok\.com|pinterest\.com)$/i;
const technicalWords=/\b(drop|peso|weight|grams?|g\b|mm\b|stack|height|entressola|midsole|upper|cabedal|mesh|solado|outsole|borracha|rubber|lightstrike|continental|specs?|specifications?|technical|tecnologia|tecnologias|amortecimento|cushioning|running|corrida)\b/gi;
function normalized(value:string) {
 return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}
export type RankedResearchCandidate = { hit:ResearchHit; score:number; reason:string };
export function rankTechnicalSources(hits:readonly ResearchHit[], identity:{brand:string;model:string}, limit=3):{
 selected:ResearchHit[];
 candidates:RankedResearchCandidate[];
} {
 const model=normalized(identity.model).replace(/[^a-z0-9]+/g," ").trim();
 const tokens=model.split(" ").filter(t=>t.length>1);
 const brand=normalized(identity.brand).trim();
 const candidates:RankedResearchCandidate[]=hits.map(hit=>{
  let host:string;
  try {
   const url=new URL(hit.url);
   if(url.protocol!=="https:"||url.username||url.password)throw Error("unsafe");
   host=url.hostname.toLowerCase().replace(/^www\./,"");
  }catch {
   return {hit,score:-999,reason:"INVALID_URL"};
  }
  if(irrelevantHosts.test(host))return {hit,score:-999,reason:"NON_TECHNICAL_PLATFORM"};
  const title=normalized(hit.title),body=normalized(hit.title+" "+hit.snippet);
  if(!tokens.every(token=>new RegExp("(^|[^a-z0-9])"+token+"([^a-z0-9]|$)").test(body)))
   return {hit,score:-999,reason:"MODEL_NOT_CONFIRMED"};
  if(brand&&!body.includes(brand))return {hit,score:-999,reason:"BRAND_NOT_CONFIRMED"};
  const technicalTerms=new Set(body.match(technicalWords)??[]).size;
  const manufacturer=host.includes(brand.replace(/\s+/g,"")) ? 1:0;
  const score=(manufacturer?6:2)+Math.min(technicalTerms,8)*3+
   (/(ficha|spec|technical|review|teste|analise|details|detalhes)/.test(body)?3:0)+
   Math.min(hit.snippet.length,500)/250;
  return {hit,score,reason:manufacturer?"MANUFACTURER_CANDIDATE":"TECHNICAL_CANDIDATE"};
 }).sort((a,b)=>b.score-a.score||a.hit.url.localeCompare(b.hit.url));
 const selected:ResearchHit[]=[];
 const groups=new Set<string>();
 for(const candidate of candidates) {
  if(candidate.score<0)continue;
  const host=new URL(candidate.hit.url).hostname.toLowerCase().replace(/^www\./,"");
  // adidas.com and adidas.com.br belong to the same manufacturer: one source group.
  const manufacturer=host.includes(brand.replace(/\s+/g,""));
  const group=manufacturer?"manufacturer:"+brand:"host:"+host;
  if(groups.has(group))continue;
  groups.add(group);
  selected.push(candidate.hit);
  if(selected.length>=limit)break;
 }
 return {selected,candidates};
}
