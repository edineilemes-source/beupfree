/** Conservative evidence comparison: numeric units, not marketing paraphrases. */
export type AgreementGroup={value:string;count:number;sourceUrls:string[]};
const decimal=(s:string)=>Number(s.replace(",","."));
const unitMM=(amount:string,unit:string)=>{
 const n=decimal(amount);
 if(!Number.isFinite(n)||n<0||n>100)return null;
 return Number((n*(/^(in|inch|inches|")$/i.test(unit)?25.4:1)).toFixed(1));
};
const display=(n:number)=>n.toString().replace(".",",");
export function normalizedValue(field:string,value:string):{key:string;display:string}|null {
 if(field==="drop"){
  const m=/^\s*(\d+(?:[.,]\d+)?)\s*(mm|inches?|in|")\s*$/i.exec(value);
  if(!m)return null;
  const n=unitMM(m[1],m[2]);
  return n===null?null:{key:"drop:"+n,display:display(n)+" mm"};
 }
 if(field==="altura_do_solado"){
  const p="(\\d+(?:[.,]\\d+)?)\\s*(mm|inches?|in|\\\")";
  const a=new RegExp("^\\s*(?:heel|calcanhar)\\s*:\\s*"+p+"\\s*[/,;]\\s*(?:forefoot|frente|antepé)\\s*:\\s*"+p+"\\s*$","i");
  const b=new RegExp("^\\s*"+p+"\\s*(?:in\\s*)?(?:heel|calcanhar)\\s*[/,;]\\s*"+p+"\\s*(?:in\\s*)?(?:forefoot|frente|antepé)\\s*$","i");
  const m=a.exec(value)||b.exec(value);
  if(!m)return null;
  const heel=unitMM(m[1],m[2]),forefoot=unitMM(m[3],m[4]);
  if(heel===null||forefoot===null)return null;
  return {key:"stack:"+heel+":"+forefoot,display:"Calcanhar "+display(heel)+" mm / antepé "+display(forefoot)+" mm"};
 }
 return null;
}
export function evidenceAgreements(field:string,sources:readonly {value:string;sourceUrl:string}[]):AgreementGroup[]{
 const grouped=new Map<string,{value:string;urls:Set<string>}>();
 for(const s of sources){
  const measure=normalizedValue(field,s.value);
  const key=measure?.key??"literal:"+s.value.normalize("NFKC").toLocaleLowerCase("pt-BR").replace(/\s+/g," ").trim();
  const prior=grouped.get(key)??{value:measure?.display??s.value,urls:new Set<string>()};
  prior.urls.add(s.sourceUrl);
  grouped.set(key,prior);
 }
 return [...grouped.values()].map(x=>({value:x.value,count:x.urls.size,sourceUrls:[...x.urls]}))
  .sort((a,b)=>b.count-a.count||a.value.localeCompare(b.value));
}
