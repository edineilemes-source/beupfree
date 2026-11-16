import test from "node:test";
import assert from "node:assert/strict";
import {rankTechnicalSources} from "./sourceSelection";
import type {ResearchHit} from "./research";

const hit=(url:string,title:string,snippet:string):ResearchHit=>({url,title,snippet,sourceType:"RETAILER"});
test("ranking selects full-model technical sources, not YouTube or Tavily corporate pages",()=>{
 const hits=[
  hit("https://www.adidas.com/us/evo-sl","Adidas Adizero Evo SL","Running shoes"),
  hit("https://www.adidas.com.br/evo-sl","Adidas Adizero Evo SL","Running shoes"),
  hit("https://www.youtube.com/watch?v=x","Adidas Adizero Evo SL technical review","drop weight"),
  hit("https://tavily.com/knowledge/brand","Adidas Adizero Evo SL knowledge","specs"),
  hit("https://retailer.example/evo-sl","Adidas Adizero Evo SL specifications","drop 6mm midsole Lightstrike Pro outsole rubber mesh"),
  hit("https://review.example/evo-sl","Adidas Adizero Evo SL running review","weight stack drop midsole outsole"),
  hit("https://retailer.example/other","Adidas Adizero Adios Pro 4","drop 6mm weight 220g"),
 ];
 const result=rankTechnicalSources(hits,{brand:"Adidas",model:"Adizero Evo SL"},3);
 assert.equal(result.selected.length,3);
 assert.equal(new Set(result.selected.map(h=>new URL(h.url).hostname)).size,3);
 assert.ok(result.selected.some(h=>h.url.includes("retailer.example")));
 assert.ok(result.selected.some(h=>h.url.includes("review.example")));
 assert.ok(result.selected.some(h=>h.url.includes("adidas.com")));
 assert.ok(result.candidates.some(c=>c.reason==="NON_TECHNICAL_PLATFORM"));
 assert.ok(result.candidates.some(c=>c.reason==="MODEL_NOT_CONFIRMED"));
});
test("ranking rejects malformed URLs, other brands and model lookalikes",()=>{
 const result=rankTechnicalSources([
  hit("http://insecure.example/evo","Adidas Adizero Evo SL","drop"),
  hit("https://other.example/evo","Nike Adizero Evo SL","drop"),
  hit("https://other.example/evo2","Adidas Adizero Evo SL2","drop"),
  hit("https://real.example/evo","Adidas Adizero EVO-SL Tech Spec","midsole drop outsole"),
 ],{brand:"Adidas",model:"Adizero Evo SL"},3);
 assert.deepEqual(result.selected.map(x=>x.url),["https://real.example/evo"]);
});


test("adidas.com and adidas.com.br count as same manufacturer, not two independent sources",()=>{
 const list=[
  hit("https://www.adidas.com/us/evo","Adidas Adizero Evo SL specifications","drop 6mm weight 224 g"),
  hit("https://www.adidas.com.br/br/evo","Adidas Adizero Evo SL details","drop 6mm outsole rubber"),
  hit("https://shop.example/evo","Adidas Adizero Evo SL ficha tecnica","drop 6mm mesh outsole rubber"),
  hit("https://review.example/evo","Adidas Adizero Evo SL running review","drop 6mm midsole and weight"),
 ];
 const selected=rankTechnicalSources(list,{brand:"Adidas",model:"Adizero Evo SL"},3).selected;
 assert.equal(selected.length,3);
 assert.equal(selected.filter(s=>new URL(s.url).hostname.includes("adidas")).length,1);
 assert.ok(selected.some(s=>s.url.includes("shop.example")));
 assert.ok(selected.some(s=>s.url.includes("review.example")));
});
