import { Router } from "express";
import pg from "pg";
import { buildProjectionWhere } from "../catalogSearchProjection/repository";
import { operationalFilters } from "../publicCatalog/operational";
import { resolvePublicCatalogSource } from "../publicCatalog/policy";

export const TECHNICAL_TERMS = {
  amortecimento: { field: "amortecimento" },
  maciez: { text: "maci" },
  conforto: { text: "confort" },
  cabedal: { field: "cabedal" },
  drop: { field: "drop" },
  solado: { field: "solado" },
  material: { field: "material" },
} as const;
export type TechnicalTerm = keyof typeof TECHNICAL_TERMS;
export function technicalTermPredicate(term:TechnicalTerm,placeholder:string):string {
  const rule=TECHNICAL_TERMS[term];
  return "field" in rule ? "f->>'field' = "+placeholder : "lower(coalesce(f->>'value','')) LIKE "+placeholder;
}
/** Read-only matching of cached, sourced technical fields on eligible real offers. */
export function createTechnicalCatalogRouter(){
 const router=Router();
 let pool:pg.Pool|undefined;
 router.get("/search",async(req,res)=>{
  if(resolvePublicCatalogSource(process.env)!=="operational")
   return res.status(404).json({code:"OPERATIONAL_CATALOG_REQUIRED"});
  const raw=req.query.tecnica;
  const requested=typeof raw==="string"?raw.split(",").map(s=>s.trim()).filter(Boolean):[];
  if(!requested.length||requested.length>4||requested.some(t=>!(t in TECHNICAL_TERMS)))
   return res.status(400).json({code:"INVALID_TECHNICAL_FILTER"});
  const terms=[...new Set(requested)] as TechnicalTerm[];
  try{
   pool??=new pg.Pool({connectionString:process.env.AWIN_CURATOR_DATABASE_URL,max:3,statement_timeout:8000});
   const filters=operationalFilters(req.query);
   const built=buildProjectionWhere(filters);
   const args:unknown[]=[...built.params];
   const add=(value:unknown)=>{args.push(value);return "$"+args.length;};
   const conditions=terms.map(term=>{
    const rule=TECHNICAL_TERMS[term];
    const param=add("field" in rule?rule.field:"%"+rule.text+"%");
    return "EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(cache.result->'card'->'fields','[]'::jsonb)) AS f "+
      "WHERE f->>'status' IN ('VERIFIED','SINGLE_SOURCE') "+
      "AND nullif(f->>'value','') IS NOT NULL AND "+technicalTermPredicate(term,param)+")";
   });
   const limit=add(6);
   const sql="SELECT c.product_id,c.product_name,c.primary_image_url,c.brand_raw,c.activities,"+
     "c.normalized_sizes,c.current_price,c.previous_price,c.discount_percent,"+
     "o.affiliate_url,m.name AS merchant_name,cache.result->'card'->'fields' AS fields,"+
     "count(*) OVER()::integer AS total "+
     "FROM catalog_search_products c "+
     "JOIN commerce_merchants m ON m.id=c.merchant_id "+
     "JOIN offers o ON o.id=c.representative_offer_id "+
     "JOIN product_intelligence_cache cache ON cache.master_id=c.product_id::text "+
     "WHERE "+built.sql+" AND (cache.expires_at IS NULL OR cache.expires_at>NOW()) "+
     "AND cache.result->>'state'='ENRICHED' AND cache.result->'card'->>'masterId'=c.product_id::text "+
     "AND "+conditions.join(" AND ")+" ORDER BY c.discount_percent DESC,c.product_id,c.merchant_id LIMIT "+limit;
   const {rows}=await pool.query({text:sql,values:args,query_timeout:8000});
   const products=rows.map(row=>({
    id:row.product_id,mainName:row.product_name,mainImageUrl:row.primary_image_url,
    brand:{name:row.brand_raw},activities:row.activities,normalizedSizes:row.normalized_sizes,
    demonstrative:false,
    bestOffer:{currentPrice:String(row.current_price),originalPrice:String(row.previous_price),
     discountPercent:Number(row.discount_percent),affiliateUrl:row.affiliate_url,
     marketplaceName:row.merchant_name,demonstrative:false},
    verifiedEvidence:(Array.isArray(row.fields)?row.fields:[])
      .filter((f:{field?:string;value?:string;status?:string})=>f.status==="VERIFIED"||f.status==="SINGLE_SOURCE")
      .filter((f:{field?:string;value?:string})=>terms.some(t=>{
       const r=TECHNICAL_TERMS[t];
       return "field" in r?f.field===r.field:(f.value??"").toLowerCase().includes(r.text);
      }))
      .map((f:{field:string;value:string;status:string})=>({field:f.field,value:f.value,status:f.status})),
   }));
   return res.json({catalogSource:"operational",demonstrative:false,technicalSource:"verified-cache-only",
    total:rows.length?Number(rows[0].total):0,products,
    notice:"Busca somente evidências técnicas gravadas e válidas. Nenhum resultado não significa que outros produtos não possuam a característica."});
  }catch(error){
   console.error("Technical catalog search failed",error instanceof Error?error.message:"unknown");
   return res.status(503).json({code:"TECHNICAL_SEARCH_UNAVAILABLE"});
  }
 });
 return router;
}
