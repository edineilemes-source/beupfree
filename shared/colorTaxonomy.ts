import { CANONICAL_COLORS, COLOR_FAMILIES, COLOR_REVIEW_TERMS } from "./colorTaxonomyVocabulary";
export { CANONICAL_COLORS, COLOR_FAMILIES };
export const COLOR_TAXONOMY_VERSION = "uppulse-colors-v3-2026-10-06";
export const COLOR_NORMALIZER_VERSION = `uppulse-normalizer-v3-${COLOR_TAXONOMY_VERSION}`;
export const COLOR_FILTER_CONTRACT_VERSION = "uppulse-color-families-v3";
export type ColorFamilyId = typeof COLOR_FAMILIES[number]["id"];
export type ColorClassification = "EXACT" | "ALIAS" | "COMPOUND" | "PARTIAL" | "REVIEW" | "UNKNOWN";
export type ColorResidual = {term:string;reason:string;kind:string};
export type ColorLexeme = {raw:string;start:number;end:number;kind:string;canonicalColorId?:string};
export interface ColorInterpretation {
 rawColor:string|null; canonicalColorIds:string[]; canonicalColors:string[];
 colorFamilyIds:ColorFamilyId[]; candidateFamilyIds:ColorFamilyId[];
 classification:ColorClassification; residualTerms:ColorResidual[]; lexicalInterpretation:ColorLexeme[];
 appearanceQualifiers:string[]; chromaticState:"declared-incolor"|null;
 projectionEligible:boolean; reviewRequired:boolean; confidence:number; reasonCodes:string[];
 taxonomyVersion:string; parserVersion:string;
}
const fold=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
const unique=<T,>(a:T[])=>Array.from(new Set(a));
const familyByCode = new Map<string,ColorFamilyId>(COLOR_FAMILIES.map(f=>[f.label.toUpperCase(),f.id]));
const vocabulary = new Map<string,typeof CANONICAL_COLORS[number]>(CANONICAL_COLORS.map(c=>[c.id,c]));
const phrases=CANONICAL_COLORS.flatMap(c=>[c.label,...c.aliases].map(phrase=>({parts:fold(phrase).split(/\s+/),id:c.id}))).sort((a,b)=>b.parts.length-a.parts.length);

// Official attribute text only. Never use these derived values to calculate identity.
export function interpretColor(rawColor:string|null|undefined):ColorInterpretation {
 const raw=rawColor??null, text=raw??"";
 const tokens=Array.from(text.matchAll(/[^\s/+,&]+|[/+,&]/gu),m=>({raw:m[0],start:m.index!,end:m.index!+m[0].length}));
 const lexicalInterpretation:ColorLexeme[]=[], canonicalColorIds:string[]=[], residualTerms:ColorResidual[]=[], appearanceQualifiers:string[]=[];
 const separator=(s:string)=>/^[/+,&]$/.test(s);
 let malformed=false;
 for(let i=0;i<tokens.length;){
  const token=tokens[i];
  if(separator(token.raw)){
   if(i===0||i===tokens.length-1||separator(tokens[i-1].raw))malformed=true;
   lexicalInterpretation.push({...token,kind:"separator"});i++;continue;
  }
  // Surface exception must run before accent folding: rose is not rosê.
  if(token.raw.toLowerCase()==="rose"){
   lexicalInterpretation.push({...token,kind:"review_term"});residualTerms.push({term:token.raw,reason:COLOR_REVIEW_TERMS.rose,kind:"ambiguous_alias"});i++;continue;
  }
  const match=phrases.find(p=>p.parts.every((part,j)=>tokens[i+j]&&!separator(tokens[i+j].raw)&&fold(tokens[i+j].raw)===part));
  if(match){
   let length=match.parts.length;
   // Specific off-white with English gloss; slash-separated white stays a concept.
   if(match.id==="off-white"&&tokens[i+length]?.raw.toLowerCase()==="white")length++;
   const end=tokens[i+length-1].end, surface=text.slice(token.start,end);
   lexicalInterpretation.push({raw:surface,start:token.start,end,kind:surface===vocabulary.get(match.id)!.label?"canonical":"alias",canonicalColorId:match.id});
   canonicalColorIds.push(match.id);
   if(match.id==="incolor")residualTerms.push({term:surface,reason:"Estado incolor sem família aprovada.",kind:"ambiguous_family"});
   i+=length;continue;
  }
  const lookup=fold(token.raw);
  if(lookup==="neon"||lookup==="metallic"){
   appearanceQualifiers.push(lookup);lexicalInterpretation.push({...token,kind:"appearance"});i++;continue;
  }
  let end=token.end,length=1;
  if(lookup==="onca"&&fold(tokens[i+1]?.raw??"")==="claro"){end=tokens[i+1].end;length=2;}
  const surface=text.slice(token.start,end),reason=COLOR_REVIEW_TERMS[fold(surface)]??"Termo desconhecido; não inferir família.";
  lexicalInterpretation.push({raw:surface,start:token.start,end,kind:"review_term"});
  residualTerms.push({term:surface,reason,kind:"non_color_or_ambiguous"});i+=length;
 }
 const ids=unique(canonicalColorIds), canonicalColors=ids.map(id=>vocabulary.get(id)!.label);
 const families=unique(ids.flatMap(id=>vocabulary.get(id)!.families.map(code=>familyByCode.get(code)!)));
 if(appearanceQualifiers.includes("metallic")&&!families.includes("metalico"))families.push("metalico");
 if(ids.length>5)residualTerms.push({term:text,reason:"Confirmar paleta da variante versus lista de opções.",kind:"source_semantics"});
 if(malformed)residualTerms.push({term:text,reason:"Segmento vazio ou separador sem cor.",kind:"invalid_format"});
 const blocked=malformed||ids.length>5;
 const classification:ColorClassification=blocked?"REVIEW":residualTerms.length?(families.length?"PARTIAL":ids.length?"REVIEW":"UNKNOWN"):ids.length>1?"COMPOUND":ids.length===1?(text===canonicalColors[0]?"EXACT":"ALIAS"):families.length?"ALIAS":"UNKNOWN";
 const projectionEligible= ["EXACT","ALIAS","COMPOUND","PARTIAL"].includes(classification)&&families.length>0;
 return {rawColor:raw,canonicalColorIds:ids,canonicalColors,colorFamilyIds:projectionEligible?families:[],candidateFamilyIds:classification==="REVIEW"?families:[],classification,residualTerms,lexicalInterpretation,appearanceQualifiers:unique(appearanceQualifiers),chromaticState:ids.includes("incolor")?"declared-incolor":null,projectionEligible,reviewRequired:residualTerms.length>0,confidence:{EXACT:1,ALIAS:.98,COMPOUND:/[/+,&]/.test(text)?.97:.90,PARTIAL:.75,REVIEW:.5,UNKNOWN:0}[classification],reasonCodes:[text.trim()?`COLOR_${classification}`:"COLOR_MISSING"],taxonomyVersion:COLOR_TAXONOMY_VERSION,parserVersion:COLOR_TAXONOMY_VERSION};
}

export function canonicalColor(id:string){return vocabulary.get(id);}
export function colorFamily(id:string){return COLOR_FAMILIES.find(f=>f.id===id);}
export class ColorFilterError extends Error { constructor(public code:"INVALID_COLOR_FAMILY"|"INVALID_COLOR_PARAMETERS"){super(code);} }
// Legacy singleton aliases are compatible. Compounds and partial values need reselection.
export function resolveColorFilter(value:string):ColorFamilyId {
 if(colorFamily(value))return value as ColorFamilyId;
 const interpreted=interpretColor(value);
 if(["EXACT","ALIAS"].includes(interpreted.classification)&&interpreted.canonicalColorIds.length===1&&interpreted.colorFamilyIds.length===1)return interpreted.colorFamilyIds[0];
 throw new ColorFilterError("INVALID_COLOR_FAMILY");
}
export function parseColorFilter(value:unknown):ColorFamilyId[] {
 if(value===undefined)return [];
 if(typeof value!=="string")throw new ColorFilterError("INVALID_COLOR_PARAMETERS");
 return unique(value.split(",").map(v=>v.trim()).filter(Boolean).map(resolveColorFilter)).sort();
}
// Preserve invalid selections in UI so a user can remove them and recover from HTTP 400.
export function colorSelection(value:string):string {try{return resolveColorFilter(value);}catch{return value;}}
export type VariantColor = ColorInterpretation & {variantId:string;sourceField:string;provenance:Readonly<Record<string,string>>};
export function normalizeVariantColor(variantId:string,rawColor:string|null,provenance:Readonly<Record<string,string>>={},sourceField="colour"):VariantColor {
 return {...interpretColor(rawColor),variantId,sourceField,provenance:{...provenance}};
}
