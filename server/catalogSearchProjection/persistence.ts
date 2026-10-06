import type pg from "pg";
type Queryable=Pick<pg.Pool,"query">;

// Call inside the projection transaction, after candidate validation and upserts.
export async function removeStaleMerchantProjection(db:Queryable,externalMerchantId:string,productIds:string[]):Promise<number>{
 if(!externalMerchantId.trim()||!productIds.length||productIds.some(id=>!id.trim()))throw new Error("PROJECTION_REPLACEMENT_SCOPE_REQUIRED");
 const result=await db.query(`DELETE FROM catalog_search_products WHERE merchant_id=(SELECT id FROM commerce_merchants WHERE external_merchant_id=$1) AND NOT (product_id=ANY($2::text[]))`,[externalMerchantId,productIds]);
 return result.rowCount??0;
}
