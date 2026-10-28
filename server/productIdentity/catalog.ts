/** Scheduling only: unchanged historical engines run on every within/cross tile.
 * Budgets/top-K are local to a tile. This is not a claim of exhaustive pair search.
 */
import {parseProductIdentity} from '../../shared/product-identity/parser';
import {matchProductIdentities} from '../../shared/product-identity/matcher';
import {snapshot, digest, compare, pairKey, VERSIONS, type MerchantProduct} from './contracts';
import {configSchema} from './candidates';
import {runShadow} from './shadow';
import {simulateGroups} from './grouping';
type Logical=ReturnType<typeof runShadow>['logical'];
type Tile=Pick<Logical,'pairs'|'candidates'|'identityCoverage'>;
export interface CatalogCheckpoint {
 load(key:string):Promise<Tile|null>;
 save(key:string,tile:Tile):Promise<void>;
 progress?(cursor:number,total:number):Promise<void>;
 tileSize?:number;
}
export function planCatalogTiles(products:MerchantProduct[],tileSize=1000){
 if(!Number.isInteger(tileSize)||tileSize<1||tileSize>1000)throw Error('INVALID_TILE_SIZE');
 const blocks=new Map<string,MerchantProduct[]>();
 // Brand is exactly the historical retrieval blocking rule; missing brands have no candidates.
 const ordered=products.map(product=>({product,key:snapshot(product).key})).sort((a,b)=>compare(a.key,b.key));
 for(const {product:p} of ordered){
  const brand=parseProductIdentity(p.input).brand;
  if(!brand)continue;
  const rows=blocks.get(brand)??[];rows.push(p);blocks.set(brand,rows);
 }
 const tiles:MerchantProduct[][]=[];
 for(const brand of [...blocks.keys()].sort(compare)){
  const rows=blocks.get(brand)!,chunks:MerchantProduct[][]=[];
  for(let i=0;i<rows.length;i+=tileSize)chunks.push(rows.slice(i,i+tileSize));
  for(let i=0;i<chunks.length;i++)for(let j=i;j<chunks.length;j++)tiles.push(i===j?chunks[i]:[...chunks[i],...chunks[j]]);
 }
 return tiles;
}
export async function runCatalogShadow(products:MerchantProduct[],checkpoint:CatalogCheckpoint){
 const config=configSchema.parse({});
 const snapshots=products.map(snapshot).sort((a,b)=>compare(a.key,b.key));
 if(new Set(snapshots.map(s=>s.key)).size!==snapshots.length||new Set(snapshots.map(s=>s.externalIdentityId)).size!==snapshots.length)throw Error('DUPLICATE_MERCHANT_PRODUCT');
 const parses=snapshots.map(s=>({key:s.key,parsed:parseProductIdentity(s.input)}));
 const parsed=new Map(parses.map(p=>[p.key,p.parsed]));
 const tiles=planCatalogTiles(products,checkpoint.tileSize);
 const decisions=new Map<string,Logical['pairs'][number]>(),candidates=new Map<string,Logical['candidates'][number]>();
 const totals={retrievalComparisons:0,unexaminedPairs:0,candidatesTruncated:0,unevaluatedPairs:0,candidateOccurrences:0};
 const batchByKey=new Map<string,number>();
 // Stable initial processing units, independent of tile scheduling.
 for(let i=0;i<snapshots.length;i++)batchByKey.set(snapshots[i].key,Math.floor(i/(checkpoint.tileSize??1000)));
 for(let cursor=0;cursor<tiles.length;cursor++){
  const inputs=tiles[cursor],key=digest({revision:'missao8-tiles-v1',versions:VERSIONS,config,inputs:inputs.map(snapshot)});
  let tile=await checkpoint.load(key);
  if(!tile){const result=runShadow(inputs).logical;tile={pairs:result.pairs,candidates:result.candidates,identityCoverage:result.identityCoverage};await checkpoint.save(key,tile);}
  for(const p of tile.pairs){const old=decisions.get(p.key);if(old&&digest(old.result)!==digest(p.result))throw Error('DIVERGENT_TILE_DECISION');decisions.set(p.key,p);}
  for(const p of tile.candidates)candidates.set(p.key,p);
  for(const field of ['retrievalComparisons','unexaminedPairs','candidatesTruncated','unevaluatedPairs'] as const)totals[field]+=tile.identityCoverage[field];
  totals.candidateOccurrences+=tile.candidates.length;
  await checkpoint.progress?.(cursor+1,tiles.length);
 }
 for(const pair of decisions.values())if(candidates.has(pair.key))pair.purpose='CANDIDATE';
 const unevaluated=new Set<string>();let boundaryEvaluated=0;
 const evaluate=(a:string,b:string)=>{
  const [left,right]=[a,b].sort(compare),key=pairKey(left,right),old=decisions.get(key);
  if(old)return old.result.masterDecision;
  if(boundaryEvaluated>=config.maxEvaluatedPairs){unevaluated.add(key);return 'NOT_EVALUATED' as const;}
  boundaryEvaluated++;
  const result=matchProductIdentities(parsed.get(left)!,parsed.get(right)!);
  decisions.set(key,{key,left,right,purpose:'GROUP_VERIFICATION',result});return result.masterDecision;
 };
 const grouping=simulateGroups(snapshots.map(s=>s.key),[...decisions.values()].filter(p=>candidates.has(p.key)&&p.result.masterDecision==='AUTO_MATCH'),evaluate);
 const pairs=[...decisions.values()].sort((a,b)=>compare(a.key,b.key));
 const master={AUTO_MATCH:0,REVIEW:0,NO_MATCH:0},variant={AUTO_MATCH:0,REVIEW:0,NO_MATCH:0};
 for(const p of pairs){master[p.result.masterDecision]++;variant[p.result.variantDecision]++;}
 const haveCandidate=new Set([...candidates.values()].flatMap(p=>[p.left,p.right]));
 const withoutCandidate=snapshots.filter(s=>!haveCandidate.has(s.key)).map(s=>({key:s.key,reason:parsed.get(s.key)!.brand?'NONE_IN_SEARCHED_TILES':'BRAND_MISSING'}));
 const inputManifestHash=digest(snapshots.map(s=>({key:s.key,inputHash:s.inputHash,scope:s.scope})));
 const catalog={scheduler:'missao8-tiles-v1',identities:products.length,processed:products.length,unprocessed:0,tiles:tiles.length,
  crossBatchPairs:pairs.filter(p=>batchByKey.get(p.left)!==batchByKey.get(p.right)).length,
  boundaryEvaluated,candidateOccurrences:totals.candidateOccurrences,
  limits:'Historical top-K and budgets apply per tile. Truncation/unexamined counters are occurrences, not unique pairs. All brand-compatible tiles scheduled; no exhaustive recall claim.'};
 const logical:Logical={mode:'SHADOW',versions:VERSIONS,config,inputManifestHash,runKey:digest({inputManifestHash,versions:VERSIONS,config,scheduler:catalog.scheduler,tileSize:checkpoint.tileSize??1000}),
  coverageLimited:true,snapshots,parses,providers:[...new Set(snapshots.map(s=>s.providerId))].sort(compare),
  merchants:[...new Set(snapshots.map(s=>JSON.stringify([s.providerId,s.merchantId])))].sort(compare),
  identityCoverage:{merchantProducts:products.length,productsWithCandidate:haveCandidate.size,productsWithoutCandidate:withoutCandidate.length,candidatesGenerated:candidates.size,evaluatedPairs:pairs.length,master,variant,
   simulatedGroups:grouping.groups.filter(g=>g.members.length>1).length,singletons:grouping.groups.filter(g=>g.members.length===1).length,groupConflicts:grouping.conflicts.length,
   candidatesTruncated:totals.candidatesTruncated,retrievalComparisons:totals.retrievalComparisons,unexaminedPairs:totals.unexaminedPairs,unevaluatedPairs:totals.unevaluatedPairs+unevaluated.size},
  promotionalCoverage:{status:'NOT_MEASURED',reason:'Commercial eligibility is independent and is not an identity input.'},
  candidates:[...candidates.values()].sort((a,b)=>compare(a.key,b.key)),withoutCandidate,truncatedCandidates:[],unevaluatedPairs:[...unevaluated].sort(compare),pairs,groups:grouping.groups,groupConflicts:grouping.conflicts};
 return {status:'COMPLETE' as const,logical,catalog,measurements:{elapsedMs:0,heapDeltaBytes:0}};
}
