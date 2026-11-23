import assert from "node:assert/strict";
import test from "node:test";
import {listRegisteredStores} from "./storeRegistry";
test("lista lojas/feeds multi-merchant e multi-feed sem gravar no banco",async()=>{
 const queries:string[]=[];
 const db:any={async query(sql:string){queries.push(sql);return{rows:[
  {id:"m1",name:"Olympikus",provider:"AWIN",externalMerchantId:"17698",active:true,feedId:"f1",externalFeedId:"51837",feedName:"Default",feedActive:true,lastSeenAt:null,lastImportCompletedAt:null},
  {id:"m1",name:"Olympikus",provider:"AWIN",externalMerchantId:"17698",active:true,feedId:"f2",externalFeedId:"51838",feedName:"Extra",feedActive:true,lastSeenAt:null,lastImportCompletedAt:null},
  {id:"m2",name:"Outra loja",provider:"OTHER",externalMerchantId:"999",active:true,feedId:null,externalFeedId:null,feedName:null,feedActive:null,lastSeenAt:null,lastImportCompletedAt:null},
 ]}}};
 const stores=await listRegisteredStores(db);
 assert.equal(stores.length,2);
 assert.equal(stores[0].feeds.length,2);
 assert.equal(stores[0].externalMerchantId,"17698");
 assert.equal(stores[1].provider,"OTHER");
 assert.deepEqual(stores[1].feeds,[]);
 assert.equal(queries.length,1);
 assert.match(queries[0],/FROM commerce_merchants/);
 assert.ok(!/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER)\b/.test(queries[0]));
});
