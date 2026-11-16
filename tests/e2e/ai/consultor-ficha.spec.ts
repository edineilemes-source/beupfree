import {test,expect} from "@playwright/test";

const item={
 id:"ai-test-adidas-001",mainName:"Adidas Corrida Teste",mainImageUrl:"https://example.org/shoe.png",primaryColor:null,normalizedSizes:[41],activities:["RUNNING"],averageRating:null,totalReviews:0,
 brand:{name:"Adidas",slug:"adidas"},category:{name:"Calçados",slug:"calcados"},
 catalogStatus:"published",catalogSource:"operational",demonstrative:false,
 offersCount:1,bestOffer:{id:"offer-001",currentPrice:"399.90",originalPrice:"499.90",discountPercent:20,
 affiliateUrl:"https://example.org/offer-001",marketplaceName:"Dafiti",sellerName:"Dafiti",freeShipping:false,demonstrative:false}
};
const knowledge={status:"IDENTITY_ONLY",catalogSource:"operational",brand:"Adidas",model:"Adidas Corrida Teste",
 researchPaidEnabled:false,card:{masterId:item.id,familyKey:"a".repeat(64),modelKey:"b".repeat(64),
 variantKey:null,superHash:"c".repeat(64),fields:[],sourcesConsulted:0}};
test.beforeEach(async({page})=>{
 await page.route("**/api/products?*",async route=>{
  const q=new URL(route.request().url()).searchParams;
  const matching=q.get("marca")==="Adidas"&&q.get("modalidade")==="Corrida"&&q.get("priceMax")==="500"&&q.get("tamanho")==="41";
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
   catalogSource:"operational",demonstrative:false,serverDriven:true,total:matching?1:1,
   products:[item],facets:{brands:[{label:"Adidas",count:1}],colors:[],sizes:[],generos:[],idades:[],modalidades:[{label:"Corrida",count:1}],tipos:[{label:"Calçados",count:1}],merchants:[{label:"Dafiti",count:1}],desconto:{"Até 19%":0,"20% - 29%":1,"30% - 39%":0,"40% - 49%":0,"50% ou mais":0},frete:{Sim:0,"Não":1},avaliacoes:{},priceMin:399,priceMax:500}
  })});
 });
 await page.route("**/api/master-identities/*",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:"NO_CONFIRMED_IDENTITY",offers:[],members:[]})}));
 await page.route("**/api/product-knowledge/*",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(knowledge)}));
});
test("consultor usa criterios reais, preserva contexto e oferece link de afiliado",async({page})=>{
 await page.goto("/");
 await page.getByTestId("open-catalog-assistant").click();
 await expect(page.getByTestId("catalog-assistant")).toBeVisible();
 await page.getByRole("textbox",{name:"Converse com o consultor de tênis"}).fill("Adidas para corrida até R$ 500 tamanho 41");
 const request=page.waitForRequest(req=>req.url().includes("/api/products?")&&new URL(req.url()).searchParams.get("marca")==="Adidas"&&new URL(req.url()).searchParams.get("tamanho")==="41");
 await page.getByRole("button",{name:"Consultar"}).click();
 await request;
 await expect(page.getByTestId("assistant-result")).toHaveCount(1);
 await expect(page.getByTestId("assistant-result")).toContainText("Adidas Corrida Teste");
 await expect(page.getByTestId("assistant-result").getByRole("link",{name:"Ver oferta na loja"})).toHaveAttribute("href","https://example.org/offer-001");
});
test("consultor bloqueia dados demo e nao recomenda ofertas demonstrativas",async({page})=>{
 await page.route("**/api/products?*",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({catalogSource:"demo",demonstrative:true,products:[item]})}));
 await page.goto("/");
 await page.getByTestId("open-catalog-assistant").click();
 await page.getByRole("textbox",{name:"Converse com o consultor de tênis"}).fill("Adidas para corrida");
 await page.getByRole("button",{name:"Consultar"}).click();
 await expect(page.getByRole("alert")).toContainText("catálogo operacional não está ativo");
 await expect(page.getByTestId("assistant-result")).toHaveCount(0);
});
test("ficha exibe identidade superhash e informa que nao pesquisou APIs pagas",async({page})=>{
 await page.goto("/catalogo");
 const card=page.getByTestId("card-product-"+item.id);
 await expect(card).toBeVisible();
 await card.getByTestId("master-offers-"+item.id).click();
 await expect(page.getByTestId("product-knowledge")).toBeVisible();
 await page.getByText("Identificadores internos do produto").click();
 await expect(page.getByTestId("product-superhash")).toContainText("c".repeat(64));
 await expect(page.getByTestId("product-knowledge")).toContainText("Sem chamadas pagas");
 await expect(page.getByTestId("product-knowledge")).toContainText("As fontes disponíveis ainda não fornecem especificações técnicas verificáveis");
});

test("mudar de marca renova filtros, produtos e contagem consultada",async({page})=>{
 const itemNike={...item,id:"ai-test-nike-002",mainName:"Nike Caminhada Teste",brand:{name:"Nike",slug:"nike"}};
 const queries:string[]=[];
 await page.route("**/api/products?*",async route=>{
  const q=new URL(route.request().url()).searchParams;
  queries.push(q.toString());
  const nike=q.get("marca")==="Nike";
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
   catalogSource:"operational",demonstrative:false,serverDriven:true,
   total:nike?23:147,products:nike?[itemNike]:[item],
  })});
 });
 await page.goto("/");
 await page.getByTestId("open-catalog-assistant").click();
 const field=page.getByRole("textbox",{name:"Converse com o consultor de tênis"});
 await field.fill("Adidas para corrida até R$ 500 tamanho 41");
 await page.getByRole("button",{name:"Consultar"}).click();
 await expect(page.getByTestId("assistant-total")).toContainText("147");
 await expect(page.getByTestId("assistant-result")).toContainText("Adidas");
 await field.fill("Agora quero Nike para caminhada");
 await page.getByRole("button",{name:"Consultar"}).click();
 await expect(page.getByTestId("assistant-total")).toContainText("23");
 await expect(page.getByTestId("assistant-result")).toContainText("Nike Caminhada Teste");
 await expect(page.getByTestId("assistant-applied-filters")).toContainText("Marca: Nike");
 await expect(page.getByTestId("assistant-applied-filters")).not.toContainText("Adidas");
 await expect(page.getByTestId("assistant-applied-filters")).not.toContainText("R$ 500");
 const last=new URLSearchParams(queries.at(-1));
 expect(last.get("marca")).toBe("Nike");
 expect(last.get("modalidade")).toBe("Caminhada");
 expect(last.has("priceMax")).toBe(false);
 expect(last.has("tamanho")).toBe(false);
});
test("mensagem desconhecida não reutiliza resultados antigos nem dispara nova busca",async({page})=>{
 let calls=0;
 await page.route("**/api/products?*",async route=>{
  calls++;
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
   catalogSource:"operational",demonstrative:false,serverDriven:true,total:1,products:[item]
  })});
 });
 await page.goto("/");
 await page.getByTestId("open-catalog-assistant").click();
 const field=page.getByRole("textbox",{name:"Converse com o consultor de tênis"});
 await field.fill("Adidas corrida");
 await page.getByRole("button",{name:"Consultar"}).click();
 await expect(page.getByTestId("assistant-result")).toHaveCount(1);
 const before=calls;
 await field.fill("Quero muito amortecimento e maciez");
 await page.getByRole("button",{name:"Consultar"}).click();
 await expect(page.getByTestId("assistant-not-understood")).toBeVisible();
 await expect(page.getByTestId("assistant-result")).toHaveCount(0);
 expect(calls).toBe(before);
 await page.getByTestId("assistant-new-search").click();
 await expect(page.getByTestId("assistant-query-info")).toHaveCount(0);
});

test("versao corrigida nao herda filtros nem texto ao fechar e reabrir",async({page})=>{
 await page.goto("/");
 await page.getByTestId("input-search").fill("busca antiga do topo");
 await page.getByTestId("open-catalog-assistant").click();
 await expect(page.getByTestId("assistant-version")).toHaveText("v11.1.3");
 const input=page.getByRole("textbox",{name:"Converse com o consultor de tênis"});
 await expect(input).toHaveValue("");
 await input.fill("Adidas corrida até R$ 500 tamanho 41");
 await page.getByRole("button",{name:"Consultar"}).click();
 await expect(page.getByTestId("assistant-applied-filters")).toContainText("Tamanho: 41");
 await page.keyboard.press("Escape");
 await expect(page.getByTestId("catalog-assistant")).toBeHidden();
 await page.getByTestId("open-catalog-assistant").click();
 await expect(input).toHaveValue("");
 await expect(page.getByTestId("assistant-query-info")).toHaveCount(0);
 await input.fill("quero um tenis nike de corrida");
 await page.getByRole("button",{name:"Consultar"}).click();
 await expect(page.getByTestId("assistant-applied-filters")).toContainText("Marca: Nike");
 await expect(page.getByTestId("assistant-applied-filters")).not.toContainText("500");
 await expect(page.getByTestId("assistant-applied-filters")).not.toContainText("41");
});

test("caracteristica tecnica pesquisa somente evidencias armazenadas",async({page})=>{
 let technicalCalls=0;
 await page.route("**/api/assistant/technical/search?*",async route=>{
  technicalCalls++;
  const params=new URL(route.request().url()).searchParams;
  expect(params.get("tecnica")).toBe("amortecimento,maciez");
  expect(params.has("marca")).toBe(false);
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
   catalogSource:"operational",demonstrative:false,technicalSource:"verified-cache-only",
   total:1,products:[{...item,verifiedEvidence:[{field:"amortecimento",value:"macio",status:"SINGLE_SOURCE"}]}]
  })});
 });
 await page.goto("/");
 await page.getByTestId("open-catalog-assistant").click();
 const field=page.getByRole("textbox",{name:"Converse com o consultor de tênis"});
 await field.fill("Nike corrida até R$ 500 tamanho 41");
 await page.getByRole("button",{name:"Consultar"}).click();
 await expect(page.getByTestId("assistant-applied-filters")).toContainText("Marca: Nike");
 await field.fill("quero muito amortecimento e maciez");
 await page.getByRole("button",{name:"Consultar"}).click();
 await expect(page.getByTestId("assistant-query-mode")).toContainText("Nova pesquisa");
 await expect(page.getByTestId("assistant-applied-filters")).toContainText("Evidências técnicas: amortecimento, maciez");
 await expect(page.getByTestId("assistant-applied-filters")).not.toContainText("Nike");
 await expect(page.getByTestId("assistant-applied-filters")).not.toContainText("R$ 500");
 await expect(page.getByTestId("assistant-evidence")).toContainText("Fonte única");
 expect(technicalCalls).toBe(1);
});
test("sem evidencias técnicas não inventa especificações",async({page})=>{
 await page.route("**/api/assistant/technical/search?*",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
  catalogSource:"operational",demonstrative:false,technicalSource:"verified-cache-only",total:0,products:[]
 })}));
 await page.goto("/");
 await page.getByTestId("open-catalog-assistant").click();
 await page.getByRole("textbox",{name:"Converse com o consultor de tênis"}).fill("quero um tenis com drop");
 await page.getByRole("button",{name:"Consultar"}).click();
 await expect(page.getByRole("status")).toContainText("Nenhuma oferta com evidências técnicas");
 await expect(page.getByTestId("assistant-result")).toHaveCount(0);
});

test("frase exata Nike corrida nao herda Adidas preco ou numeracao em conversa aberta",async({page})=>{
 const recorded:string[]=[];
 await page.route("**/api/products?*",async route=>{
  const q=new URL(route.request().url()).searchParams;
  recorded.push(q.toString());
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
   catalogSource:"operational",demonstrative:false,serverDriven:true,total:12,
   products:[{...item,mainName:q.get("marca")+" Corrida Teste"}]
  })});
 });
 await page.goto("/");
 await page.getByTestId("open-catalog-assistant").click();
 const field=page.getByRole("textbox",{name:"Converse com o consultor de tênis"});
 await field.fill("Adidas corrida até R$ 500 tamanho 41");
 await page.getByRole("button",{name:"Consultar"}).click();
 await expect(page.getByTestId("assistant-applied-filters")).toContainText("Tamanho: 41");
 await field.fill("quero um tenis nike de corrida");
 await page.getByRole("button",{name:"Consultar"}).click();
 await expect(page.getByTestId("assistant-query-mode")).toHaveText("Nova pesquisa");
 await expect(page.getByTestId("assistant-applied-filters")).toContainText("Marca: Nike");
 await expect(page.getByTestId("assistant-applied-filters")).not.toContainText("Preço máximo:");
 await expect(page.getByTestId("assistant-applied-filters")).not.toContainText("Tamanho:");
 const q=new URLSearchParams(recorded.at(-1));
 expect(q.get("marca")).toBe("Nike");
 expect(q.get("modalidade")).toBe("Corrida");
 expect(q.has("priceMax")).toBe(false);
 expect(q.has("tamanho")).toBe(false);
});

test("ficha inteligente abre piloto de tres fontes e mostra divergencias sem alterar produto",async({page})=>{
 await page.route("**/api/product-knowledge/pilot/evo-sl",route=>route.fulfill({
  status:200,contentType:"application/json",
  body:JSON.stringify({
   pilot:true,pilotVersion:"11.2-golden-data-1",status:"PRE_EXTRACTED_NOT_LIVE",
   identity:{brand:"Adidas",model:"Adizero Evo SL"},
   card:{masterId:"pilot-evo-sl-not-a-commercial-master",familyKey:"a".repeat(64),
    modelKey:"b".repeat(64),variantKey:null,superHash:"d".repeat(64),sourcesConsulted:3,
    fields:[{field:"drop",value:"6 mm",status:"VERIFIED",sources:[
     {field:"drop",value:"6 mm",sourceUrl:"https://www.adidas.com.br/adizero_evo_sl",sourceType:"MANUFACTURER",observedAt:"2026-11-16"},
     {field:"drop",value:"6 mm",sourceUrl:"https://www.netshoes.com.br",sourceType:"RETAILER",observedAt:"2026-11-16"}]},
     {field:"cabedal",value:null,status:"CONFLICT",sources:[
      {field:"cabedal",value:"Têxtil",sourceUrl:"https://www.adidas.com.br",sourceType:"MANUFACTURER",observedAt:"2026-11-16"},
      {field:"cabedal",value:"Mesh",sourceUrl:"https://www.centauro.com.br",sourceType:"RETAILER",observedAt:"2026-11-16"}]}]},
   sources:[{name:"adidas",url:"https://www.adidas.com.br/adizero_evo_sl",type:"MANUFACTURER"},
    {name:"Centauro",url:"https://www.centauro.com.br",type:"RETAILER"},
    {name:"Netshoes",url:"https://www.netshoes.com.br",type:"RETAILER"}],
   metrics:{sourcePages:3,fields:2,verifiedFields:1,singleSourceFields:0,conflictingFields:1},
   narrative:"Descrição técnica experimental do Adizero Evo SL.",warnings:["Sem pesquisa externa automática."]
  })
 }));
 await page.goto("/catalogo");
 const card=page.getByTestId("card-product-"+item.id);
 await expect(card).toBeVisible();
 await card.getByTestId("master-offers-"+item.id).click();
 await expect(page.getByTestId("evo-sl-pilot")).toBeVisible();
 await page.getByTestId("run-evo-sl-pilot").click();
 await expect(page.getByTestId("evo-sl-pilot-results")).toContainText("Adizero Evo SL");
 await expect(page.getByTestId("evo-sl-pilot-results")).toContainText("Divergência entre fontes");
 await expect(page.getByTestId("evo-sl-pilot-results")).toContainText("3 páginas de referência");
 await page.getByText("Identificadores internos do produto").click();
 await expect(page.getByTestId("product-superhash")).toHaveText("c".repeat(64));
});


test("ficha narrativa da IA real exibe citacoes discretas e auditoria expansivel",async({page})=>{
 const sources=[
  ["https://believeintherun.com/shoe-reviews/adidas-adizero-evo-sl-review","6 mm"],
  ["https://www.alastairrunning.com/adidas-adizero-evo-sl-review","6mm"],
  ["https://www.doctorsofrunning.com/adidas-adizero-evo-sl-review-2024","6.5 mm"],
 ];
 const evidence=sources.map(([sourceUrl,value])=>({field:"drop",sourceUrl,value,sourceType:"INDEPENDENT_TEST",observedAt:"2026-11-16"}));
 await page.route("**/api/product-knowledge/pilot/live-evo-sl-v2",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify({
   live:true,status:"ENRICHED",finished:"2026-11-16T18:00:00Z",
   started:"2026-11-16T17:00:00Z",searchProvider:"Tavily",extractionProvider:"OpenAI",
   requestsReserved:{tavily:2,openai:3},sourceCount:3,distinctDomains:3,
   searchedSources:sources.map(([url])=>({url,title:"Adizero Evo SL"})),
   fields:[{field:"drop",value:null,status:"CONFLICT",sources:sources.map(([url,value])=>({url,value}))}],
   warnings:[],limitations:[],qualityGate:false,metrics:{fields:1,verified:0,conflicts:1,domainsWithEvidence:3},
   reconciled:{metrics:{fields:1,verified:0,conflicts:1,conflictsWithMajority:1},
    fields:[{field:"drop",value:null,status:"CONFLICT",sources:evidence,
     agreements:[{value:"6 mm",count:2,sourceUrls:sources.slice(0,2).map(x=>x[0])},
       {value:"6,5 mm",count:1,sourceUrls:[sources[2][0]]}]},
     {field:"entressola",value:"Full-length Lightstrike Pro superfoam with a stiff composite/nylon midfoot shank",status:"SINGLE_SOURCE",sources:[{field:"entressola",sourceUrl:sources[1][0],value:"Full-length Lightstrike Pro superfoam with a stiff composite/nylon midfoot shank",sourceType:"INDEPENDENT_TEST",observedAt:"2026-11-16"}]},
     {field:"peso",value:"8.3oz / 235g",status:"SINGLE_SOURCE",sources:[{field:"peso",sourceUrl:sources[1][0],value:"8.3oz / 235g",sourceType:"INDEPENDENT_TEST",observedAt:"2026-11-16"}]}]}
  })
 }));
 await page.goto("/catalogo");
 const card=page.getByTestId("card-product-"+item.id);
 await expect(card).toBeVisible();
 await card.getByTestId("master-offers-"+item.id).click();
 const windowBox=await page.getByTestId("master-dialog").boundingBox();
 const viewport=page.viewportSize();
 expect(windowBox).not.toBeNull();
 expect(viewport).not.toBeNull();
 expect(windowBox!.width).toBeGreaterThanOrEqual(viewport!.width-2);
 expect(windowBox!.height).toBeGreaterThanOrEqual(viewport!.height-2);
 await page.getByTestId("read-evo-sl-live-v2").click();
 const narrative=page.getByTestId("intelligent-product-card").last();
 await expect(narrative).toContainText("6 mm ou 6,5 mm");
 await expect(narrative.getByTestId("customer-field-entressola")).toContainText("Espuma Lightstrike Pro em toda a entressola");
 await expect(narrative.getByTestId("customer-field-peso")).toContainText("235 g");
 await expect(narrative.getByRole("link",{name:/Fonte/})).toHaveCount(2);
 const audit=narrative.getByTestId("intelligent-evidence-audit");
 await expect(audit).toBeVisible();
 await audit.locator("summary").click();
 await expect(audit).toContainText("6.5 mm");
 await expect(audit.getByRole("link",{name:"doctorsofrunning.com"})).toHaveCount(2);
});
