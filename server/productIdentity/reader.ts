import type {Pool} from 'pg';
import {DEMOGRAPHIC_TAXONOMY_VERSION} from '../../shared/demographicTaxonomy';
// A member is readable only while its observed source is unchanged. Never require identity for publication.
const currentMembership=`m.valid_to IS NULL AND p.main_name=m.evidence->'snapshot'->'input'->>'name'
 AND p.updated_at IS NOT DISTINCT FROM (m.evidence->'sourceRevision'->>'productUpdatedAt')::timestamptz
 AND e.last_seen_at IS NOT DISTINCT FROM (m.evidence->'sourceRevision'->>'identityLastSeenAt')::timestamptz
 AND (SELECT count(*) FROM product_variants v WHERE v.product_id=e.product_id AND v.provider_id=e.provider_id AND v.merchant_id=e.merchant_id)
   = jsonb_array_length(m.evidence->'snapshot'->'observedVariants')
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m.evidence->'snapshot'->'observedVariants') observed
   LEFT JOIN product_variants v ON v.id=observed->>'id' AND v.product_id=e.product_id AND v.provider_id=e.provider_id AND v.merchant_id=e.merchant_id
   WHERE v.id IS NULL OR (v.size,v.colour,v.gtin,v.ean,v.upc,v.mpn,v.external_variant_key) IS DISTINCT FROM
    (observed->>'size',observed->>'colour',observed->>'gtin',observed->>'ean',observed->>'upc',observed->>'mpn',observed->>'externalVariantKey'))`;
export async function readMaster(db:Pick<Pool,'query'>,productId:string){
 const memberships=(await db.query(`SELECT m.master_product_id FROM product_master_memberships m
  JOIN external_product_identities e ON e.id=m.external_product_identity_id JOIN products p ON p.id=e.product_id
  WHERE e.product_id=$1 AND ${currentMembership}`,[productId])).rows;
 // Ambiguous origin mapping must not enrich a public card.
 if(memberships.length!==1)return null;
 const masterId=memberships[0].master_product_id;
 const master=(await db.query('SELECT * FROM master_products WHERE id=$1',[masterId])).rows[0];
 const members=(await db.query(`SELECT e.product_id,e.id external_identity_id,e.provider_id,e.merchant_id,p.main_name,m.assignment_method,
   m.evidence->'snapshot'->'observedVariants' variants,m.evidence->'snapshot'->'input' input,
   m.run_id,m.evidence FROM product_master_memberships m JOIN external_product_identities e ON e.id=m.external_product_identity_id
   JOIN products p ON p.id=e.product_id WHERE m.master_product_id=$1 AND ${currentMembership} ORDER BY e.id`,[masterId])).rows;
 // Full current group is required: never project a partial stale group as confirmed equivalence.
 const total=Number((await db.query('SELECT count(*) n FROM product_master_memberships WHERE master_product_id=$1 AND valid_to IS NULL',[masterId])).rows[0].n);
 if(total!==members.length)return null;
 const offers=(await db.query(`SELECT DISTINCT c.product_id,c.provider_id,c.merchant_id,c.representative_offer_id offer_id,
   c.product_name,c.current_price,c.previous_price,c.discount_percent,c.currency,c.normalized_sizes,c.normalized_colors,
   c.gender_normalized,c.age_group_normalized,o.affiliate_url,mer.name merchant_name
   FROM catalog_search_products c JOIN offers o ON o.id=c.representative_offer_id AND o.product_id=c.product_id
    AND o.merchant_id=c.merchant_id AND o.provider_id=c.provider_id
   JOIN commerce_merchants mer ON mer.id=c.merchant_id
   WHERE EXISTS(SELECT 1 FROM external_product_identities e JOIN product_master_memberships m ON m.external_product_identity_id=e.id
    WHERE m.master_product_id=$1 AND m.valid_to IS NULL AND e.product_id=c.product_id AND e.provider_id=c.provider_id AND e.merchant_id=c.merchant_id)
   AND c.catalog_state='CATALOG_ELIGIBLE' AND c.available=true AND c.universe='SNEAKER_CONFIRMED'
   AND c.current_price>0 AND c.previous_price>c.current_price AND c.discount_percent>0 AND c.discount_percent<=100
   AND c.demographic_taxonomy_version=$2 ORDER BY c.current_price,c.product_id,c.merchant_id`,[masterId,DEMOGRAPHIC_TAXONOMY_VERSION])).rows;
 const validOffers=offers.filter(o=>{try{return ['https:','http:'].includes(new URL(o.affiliate_url).protocol);}catch{return false;}});
 if(!validOffers.some(o=>o.product_id===productId))return null;
 return {master:{id:master.id,canonicalName:master.canonical_name,brand:master.brand_normalized,
  productType:master.product_type,modelTokens:master.model_tokens,generation:master.generation,
  technicalQualifiers:master.technical_qualifiers,modelFamily:master.attribute_evidence.master.modelFamily,
  canonicalNameStatus:master.attribute_evidence.canonicalNameStatus},
  equivalenceScope:'MASTER_ONLY',skuEquivalence:false,members:members.map(({evidence,...member})=>member),offers:validOffers};
}
