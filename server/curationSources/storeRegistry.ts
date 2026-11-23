/** Curadoria V3 - registered stores and feeds, read-only from canonical commerce tables. */
import type {Pool} from "pg";
type Queryable=Pick<Pool,"query">;
export type RegisteredStore={
 id:string;name:string;provider:string;externalMerchantId:string;active:boolean;
 feeds:Array<{id:string;externalFeedId:string;name:string|null;active:boolean;lastSeenAt:string|null;lastImportCompletedAt:string|null}>;
};
export async function listRegisteredStores(db:Queryable):Promise<RegisteredStore[]>{
 const result=await db.query(`SELECT
 m.id,m.name,m.external_merchant_id "externalMerchantId",m.active,
 cp.code provider,
 f.id "feedId",f.external_feed_id "externalFeedId",f.name "feedName",
 f.active "feedActive",f.last_seen_at "lastSeenAt",
 f.last_import_completed_at "lastImportCompletedAt"
 FROM commerce_merchants m
 JOIN commerce_providers cp ON cp.id=m.provider_id
 LEFT JOIN commerce_feeds f ON f.merchant_id=m.id AND f.provider_id=m.provider_id
 ORDER BY lower(m.name),cp.code,m.external_merchant_id,f.external_feed_id`);
 const stores=new Map<string,RegisteredStore>();
 for(const row of result.rows){
  let store=stores.get(row.id);
  if(!store){
   store={id:row.id,name:row.name,provider:row.provider,
    externalMerchantId:row.externalMerchantId,active:row.active,feeds:[]};
   stores.set(row.id,store);
  }
  if(row.feedId)store.feeds.push({
   id:row.feedId,externalFeedId:row.externalFeedId,name:row.feedName,
   active:row.feedActive,lastSeenAt:row.lastSeenAt,
   lastImportCompletedAt:row.lastImportCompletedAt
  });
 }
 return [...stores.values()];
}
