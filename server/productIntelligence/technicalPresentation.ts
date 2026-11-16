/** Translation for the currently audited Evo SL V2 excerpts.
 * Display-only: original evidence remains unchanged for traceability.
 * Unknown prose is not passed through unreliable word-by-word translation.
 */
const ptBR = new Map<string,string>([
 ["thick layer of lightstrike pro","Camada espessa de espuma Lightstrike Pro"],
 ["lightweight engineered mesh with strategic two-ply reinforcement and adidas three-stripe overlays","Mesh técnico leve, com reforços estratégicos de duas camadas e sobreposições das três listras da Adidas"],
 ["full-length lightstrike pro superfoam with a stiff composite/nylon midfoot shank","Espuma Lightstrike Pro em toda a entressola, com reforço rígido de compósito/nylon na região central"],
 ["daily training, long runs, uptempo","Treinos diários, corridas longas e treinos em ritmo acelerado"],
 ["performance lightweight trainer/racer","Tênis leve de desempenho para treinos e competições"],
 ["engineered mesh","Mesh técnico"],
 ["synthetic and textile upper","Cabedal de materiais sintéticos e têxteis"],
 ["continental rubber at the forefoot with clear rubber at the heel","Borracha Continental na parte dianteira e borracha transparente no calcanhar"],
 ["lightstrike pro midsole with midfoot nylon shank","Entressola Lightstrike Pro com reforço de nylon na região central do pé"],
 ["lightstrike pro midsole, continental rubber outsole","Entressola Lightstrike Pro e solado de borracha Continental"],
 ["7.9 oz (224 g) for a us m9, 6.6 oz (188 g) for a us w7.5","224 g (masculino, tamanho US 9); 188 g (feminino, tamanho US 7,5)"],
 ["8.3oz / 235g","235 g (numeração não informada na evidência)"],
 ["8.1 oz, 230 g (men’s size 9), 7.2 oz, 204 g (women’s size 8)","230 g (masculino, tamanho US 9); 204 g (feminino, tamanho US 8)"],
 ["clear rubber","Borracha transparente"],
]);
const normalize=(value:string)=>value.trim().toLowerCase().replace(/\s+/g," ");
const num=(value:number)=>Number(value.toFixed(1)).toLocaleString("pt-BR",{maximumFractionDigits:1});
/** Converts straightforward stand-alone values; never infers footwear sizes or gender. */
export function brazilianTechnicalText(field:string,value:string):string {
 const original=value.trim();
 const known=ptBR.get(normalize(original));
 if(known)return known;
 if(field==="drop"){
  const m=/^(\d+(?:[.,]\d+)?)\s*(mm|inches?|in|")$/i.exec(original);
  if(m){
   const n=Number(m[1].replace(",","."));
   if(Number.isFinite(n))return num(n*(m[2].toLowerCase()==="mm"?1:25.4))+" mm";
  }
 }
 if(field==="altura_do_solado"){
  // The original paired height measurement is already reconciled in mm when
  // available; handle the original 2026 research source expressions as well.
  const pair=/^(\d+(?:[.,]\d+)?)\s*(mm|inches?|in|")\s*(?:in\s*)?heel\s*[,/]\s*(\d+(?:[.,]\d+)?)\s*(mm|inches?|in|")\s*(?:in\s*)?forefoot$/i.exec(original)
   || /^heel\s*:\s*(\d+(?:[.,]\d+)?)\s*(mm|inches?|in|")\s*[/,]\s*forefoot\s*:\s*(\d+(?:[.,]\d+)?)\s*(mm|inches?|in|")$/i.exec(original);
  if(pair){
   const toMM=(v:string,u:string)=>Number(v.replace(",","."))*(u.toLowerCase()==="mm"?1:25.4);
   return "Calcanhar "+num(toMM(pair[1],pair[2]))+" mm / antepé "+num(toMM(pair[3],pair[4]))+" mm";
  }
 }
 if(field==="peso"){
  const pair=/^(\d+(?:[.,]\d+)?)\s*(?:oz|onças?)\s*[/,]\s*(\d+(?:[.,]\d+)?)\s*g$/i.exec(original);
  if(pair)return num(Number(pair[2].replace(",",".")))+" g";
  const one=/^(\d+(?:[.,]\d+)?)\s*(oz|lb|g|kg)$/i.exec(original);
  if(one){
   const n=Number(one[1].replace(",","."));
   const unit=one[2].toLowerCase();
   return unit==="kg"?num(n)+" kg":num(n*(unit==="oz"?28.349523125:unit==="lb"?453.59237:1))+" g";
  }
 }
 // Unknown terminology remains verbatim rather than manufacturing a translation.
 return original;
}
