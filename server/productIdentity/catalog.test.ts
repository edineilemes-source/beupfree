import test from 'node:test';import assert from 'node:assert/strict';
import {runCatalogShadow,planCatalogTiles} from './catalog';
import {adaptReconciledRows} from './adapter';import {fixtureRow,shadowFixture} from './fixtures';import {pairKey} from './contracts';
const inputs=()=>adaptReconciledRows(shadowFixture());
test('all within and cross tiles include equivalent products regardless of processing boundary',async()=>{
 const products=inputs(),tiles=planCatalogTiles(products,1);
 const cache=new Map();const result=await runCatalogShadow(products,{tileSize:1,load:async k=>cache.get(k)??null,save:async(k,v)=>{cache.set(k,v);}});
 assert.equal(result.catalog.processed,products.length);assert.equal(result.catalog.unprocessed,0);assert.ok(tiles.every(t=>t.length<=2));assert.ok(result.catalog.crossBatchPairs>0);
 assert.ok(result.logical.groups.some(g=>g.members.length>=3));
 for(const group of result.logical.groups)for(const a of group.members)for(const b of group.members)if(a!==b)assert.equal(result.logical.pairs.find(p=>p.key===pairKey(a,b))?.result.masterDecision,'AUTO_MATCH');
});
test('cursor resume uses immutable input-addressed tiles; retry is deterministic and drift invalidates tiles',async()=>{
 const products=inputs(),cache=new Map();let saved=0;
 const checkpoint={tileSize:1,load:async(k:string)=>cache.get(k)??null,save:async(k:string,v:any)=>{cache.set(k,v);saved++;}};
 await assert.rejects(runCatalogShadow(products,{...checkpoint,progress:async cursor=>{if(cursor===2)throw Error('INTERRUPTED');}}),/INTERRUPTED/);
 assert.equal(saved,2);
 const resumed=await runCatalogShadow(products,checkpoint),count=saved;
 const retry=await runCatalogShadow([...products].reverse(),checkpoint);assert.equal(saved,count);assert.deepEqual(resumed.logical,retry.logical);
 products[0].input.name+=' 99';await runCatalogShadow(products,checkpoint);assert.ok(saved>count);
});
test('REVIEW never becomes group equivalence and missing brands remain singleton',async()=>{
 const result=await runCatalogShadow(inputs(),{tileSize:1,load:async()=>null,save:async()=>{}});
 assert.ok(result.logical.identityCoverage.master.REVIEW>0);
 for(const pair of result.logical.pairs.filter(p=>p.result.masterDecision==='REVIEW'))assert.ok(!result.logical.groups.some(g=>g.members.includes(pair.left)&&g.members.includes(pair.right)));
 assert.equal(result.logical.coverageLimited,true);
 assert.throws(()=>planCatalogTiles(inputs(),1001),/INVALID_TILE_SIZE/);
});

test('more than 2,000 identities are scheduled without losing a pair across distant chunks',()=>{
 const rows=Array.from({length:2001},(_,i)=>fixtureRow(String(i),'Tênis Acme Comet Preto',i%2?'merchant-b':'merchant-a'));
 const products=[...adaptReconciledRows(rows.slice(0,2000)),...adaptReconciledRows(rows.slice(2000))];
 const tiles=planCatalogTiles(products);
 assert.equal(tiles.length,6);assert.ok(tiles.every(t=>t.length<=2000));
 assert.equal(new Set(tiles.flat().map(p=>p.externalIdentityId)).size,2001);
 const first=tiles[0][0].externalIdentityId,last=tiles[tiles.length-1][0].externalIdentityId;
 assert.ok(tiles.some(t=>t.some(p=>p.externalIdentityId===first)&&t.some(p=>p.externalIdentityId===last)));
});
