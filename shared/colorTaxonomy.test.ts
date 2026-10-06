import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {interpretColor,normalizeVariantColor,parseColorFilter,COLOR_FAMILIES,CANONICAL_COLORS} from "./colorTaxonomy";
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/colors-v3-real.json',import.meta.url),'utf8'));
for(const fixture of fixtures)test(`real fixture: ${fixture.rawColor}`,()=>{
 const actual=interpretColor(fixture.rawColor);
 assert.equal(actual.rawColor,fixture.rawColor);assert.equal(actual.classification,fixture.classification);
 assert.deepEqual(actual.canonicalColorIds,fixture.canonicalColorIds);assert.deepEqual(actual.colorFamilyIds,fixture.familyIds);
 assert.deepEqual(actual.residualTerms.map(r=>r.term),fixture.residualTerms);
 for(const lex of actual.lexicalInterpretation)assert.equal(fixture.rawColor.slice(lex.start,lex.end),lex.raw);
});
test('approved vocabulary and merchant independence',()=>{
 assert.equal(fixtures.length,434);assert.equal(COLOR_FAMILIES.length,14);assert.equal(CANONICAL_COLORS.length,54);
 const a=normalizeVariantColor('v','  Preto mystery  ',{merchantId:'a'}),b=normalizeVariantColor('v','  Preto mystery  ',{merchantId:'b'});
 assert.equal(a.rawColor,'  Preto mystery  ');assert.equal(a.classification,'PARTIAL');assert.deepEqual(a.colorFamilyIds,['preto']);
 assert.deepEqual({...a,provenance:{}},{...b,provenance:{}});
});
test('unknown, missing, invalid formats and no substring/fuzzy inference',()=>{
 for(const value of [null,'','   ','pretolino','onça','jeans','zebra'])assert.deepEqual(interpretColor(value).colorFamilyIds,[]);
 for(const value of ['/','preto//branco','preto/']){assert.equal(interpretColor(value).classification,'REVIEW');assert.deepEqual(interpretColor(value).colorFamilyIds,[]);}
 assert.deepEqual(interpretColor('incolor').colorFamilyIds,[]);
 assert.deepEqual(interpretColor('preto zebra').colorFamilyIds,['preto']);
 assert.deepEqual(interpretColor('rose').colorFamilyIds,[]);assert.deepEqual(interpretColor('rosé').colorFamilyIds,['rosa']);
 assert.deepEqual(interpretColor('Preto\tBRANCO').colorFamilyIds,['preto','branco']);
});
test('URL family IDs, singleton aliases, invalid constraints',()=>{
 assert.deepEqual(parseColorFilter('navy,preto,azul-marinho'),['azul','preto']);
 assert.deepEqual(parseColorFilter('café,pink,cáqui,ocre,teal,pewter'),['amarelo','bege','marrom','metalico','rosa','verde']);
 for(const input of ['incolor','preto/branco','rosa pink','preto mystery','pretolino'])assert.throws(()=>parseColorFilter(input),/INVALID_COLOR_FAMILY/);
 assert.throws(()=>parseColorFilter(['azul','preto']),/INVALID_COLOR_PARAMETERS/);
});

test('all real fixtures reconcile distinct and weighted approved classification coverage',()=>{
 const distinct:Record<string,number>={},weighted:Record<string,number>={};let automatic=0,automaticWeighted=0;
 for(const fixture of fixtures){const parsed=interpretColor(fixture.rawColor);distinct[parsed.classification]=(distinct[parsed.classification]??0)+1;weighted[parsed.classification]=(weighted[parsed.classification]??0)+fixture.quantity;if(parsed.projectionEligible){automatic++;automaticWeighted+=fixture.quantity;}}
 assert.deepEqual(distinct,{EXACT:31,ALIAS:49,COMPOUND:300,PARTIAL:43,REVIEW:7,UNKNOWN:4});
 assert.deepEqual(weighted,{EXACT:58646,ALIAS:25004,COMPOUND:6558,PARTIAL:573,REVIEW:3027,UNKNOWN:54});
 assert.equal(automatic,423);assert.equal(automaticWeighted,90781);
});
