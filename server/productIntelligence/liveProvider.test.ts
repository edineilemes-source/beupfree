import test from "node:test";
import assert from "node:assert/strict";
import { createLiveResearchProvider } from "./liveProvider";
import { enrichProduct } from "./research";
test("real provider contract searches and extracts with mocked HTTP, without exposing keys",async()=>{
 const requests:{url:string;body:any}[]=[];
 const fetcher=async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input),body=JSON.parse(String(init?.body));requests.push({url,body});
  const data=url.includes("tavily")?{results:[{url:"https://shop.example/shoe",title:"Ficha técnica",content:"Adidas Adizero Adios Pro 4, cabedal em malha."}]}:{choices:[{message:{content:JSON.stringify({fields:[{field:"cabedal",value:"Malha"},{field:"not_allowed",value:"X"}]})}}]};
  return {ok:true,json:async()=>data} as Response;
 };
 const provider=createLiveResearchProvider({tavilyApiKey:"test-tavily",openaiApiKey:"test-openai",fetcher:fetcher as typeof fetch});
 const result=await enrichProduct({masterId:"1",brand:"Adidas",model:"Adizero Adios Pro",version:"4"},provider,{get:async()=>null,set:async()=>{}});
 assert.equal(result.state,"ENRICHED");
 assert.equal(result.card.fields.find(f=>f.field==="cabedal")?.value,"Malha");
 assert.equal(requests.length,2);
 assert.equal(requests[0].body.query.includes("Adidas"),true);
 assert.equal(JSON.stringify(result).includes("test-openai"),false);
});
test("provider requires both credentials",()=>{
 assert.throws(()=>createLiveResearchProvider({tavilyApiKey:"",openaiApiKey:""}),/RESEARCH_CREDENTIALS_MISSING/);
});
