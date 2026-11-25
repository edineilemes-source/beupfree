import {test,expect} from "@playwright/test";

/** Browser contract: a single Curadoria upload starts the server-side
 * automatic flow and visibly transitions from staging to catalog validation.
 * These are mocked server responses. Real DB acceptance is a separate gate.
 */
test("Curadoria receives feed and shows automatic publication to the homologation catalog",async({page})=>{
 const sha="b".repeat(64);
 let uploads=0,staged=0,polls=0;
 const audit={
  status:"RECEIVED_AND_AUDITED",merchant:"107702",feedId:"98680",
  sha256:sha,storedName:"107702-98680-"+sha.slice(0,16)+".csv.gz",
  stats:{rows:8198,normalized:8198,invalid:0,
   priceStates:{REGULAR_PRICE:8198},taxonomy:{},eligibility:{},
   reasons:{"taxonomy:non_sneaker":3654,"taxonomy:unresolved":1698}},
  issues:[],issuesTotal:0,issuesPageSize:300,
  accepted:2846,discarded:3654,review:1698,
  imported:0,published:0,canProcess:true,
  masterSummary:{inspected:8198,unresolved:0,stageCandidates:2846,
   byReason:{},parserVersion:"product-identity-v1.5"},
  masterReviews:[],masterReviewsTotal:0
 };
 const merchantReport={
  merchant:{name:"Clovis Calçados BR",id:"107702"},
  counts:{offers:2846,distinctProducts:2846,identities:2846,
   masterMemberships:2846,classifiedProducts:2846,promotionEvidence:2846,
   searchProducts:2846,availableSearchProducts:2846},
  steps:{received:true,masterCovered:true,catalogClassified:true,
   priceAudited:true,projected:true,storeVisibleInFilter:true},
  pipeline:{stages:{},versions:{identity:{parser:"product-identity-v1.5",matcher:"product-identity-v1.2"}}},
  note:"Fonte auditada",storeFacetRule:""
 };
 await page.route(/\/api\/admin\/awin-feeds(?:\/.*)?$/,async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  const send=(data:unknown,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(data)});
  if(path.endsWith("/status")&&req.method()==="GET")
   return send({enabled:true,maxFileBytes:20971520,temporaryAccess:true,staging:true,automaticPublication:true});
  if(path.endsWith("/stores")&&req.method()==="GET")
   return send({stores:[],total:0});
  if(path.endsWith("/upload")&&req.method()==="POST"){
   uploads++;return send(audit,201);
  }
  if(path.endsWith("/process")&&req.method()==="POST"){
   staged++;
   return send({status:"STAGED_IN_DATABASE",merchant:"107702",feedId:"98680",
    accepted:2846,review:1698,discarded:3654,invalid:0,
    imported:2846,unchanged:0,published:0,
    publication:{status:"QUEUED",phase:"RECEIVED_AND_STAGED"},
    message:"Processamento iniciado na homologação."});
  }
  if(path.endsWith("/publication/107702/98680/"+sha)){
   polls++;
   return send(polls<2?
    {status:"RUNNING",phase:"COMMERCIAL_VALIDATED",published:0}:
    {status:"COMPLETED",phase:"CATALOG_VISIBLE",published:2846,
     result:{status:"ALREADY_ONBOARDED",availableSearchProducts:2846,catalogTotal:20604}});
  }
  if(path.endsWith("/merchant/107702/audit"))
   return send(merchantReport);
  return send({error:"Fixture endpoint not defined"},404);
 });
 await page.goto("/admin/curadoria/feeds");
 await expect(page.getByTestId("curadoria-auto-readiness")).toContainText("pronto para publicação automática");
 const file=page.locator('input[type="file"]');
 await file.setInputFiles({name:"107702-98680-pt_BR-Clovis.csv.gz",
  mimeType:"application/gzip",buffer:Buffer.from([31,139,8,0,1,2,3,4,5])});
 await page.getByRole("button",{name:"Enviar e validar produtos"}).click();
 await expect(page.getByTestId("automatic-publication-status")).toContainText("Produtos aprovados e disponíveis no catálogo: 2.846",{timeout:20000});
 await expect(page.getByRole("button",{name:"Ver produtos da loja na vitrine"})).toBeVisible();
 expect(uploads).toBe(1);
 expect(staged).toBe(1);
 expect(polls).toBeGreaterThan(0);
});
