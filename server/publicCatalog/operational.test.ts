import assert from "node:assert/strict";
import test from "node:test";
import { createOperationalPublicCatalogHandlers } from "./operational";

const row={product_id:"p1",product_name:"Tênis",primary_image_url:"https://img.test/x",normalized_colors:["preto"],brand_raw:"Marca",brand_normalized:"marca",universe:"CALCADOS",representative_offer_id:"o1",current_price:"80",previous_price:"100",discount_percent:20,affiliate_url:"https://affiliate.test/x",merchant_name:"Loja",source_updated_at:new Date("2026-09-02T00:00:00Z")};
const repo:any={async listProducts(filters:any){repo.filters=filters;return[row]},async countProducts(){return 1},async getProduct(id:string){return id==="p1"?[row]:[]},async getOffer(id:string){return id==="o1"?row:null},async getFacets(){return{}}};
function response(){const state:any={headers:{}};return Object.assign(state,{setHeader(k:string,v:string){state.headers[k]=v},status(code:number){state.statusCode=code;return state},json(body:any){state.body=body;return state},redirect(url:string){state.redirectUrl=url;return state}})}
function request(query:any={},params:any={}){return{query,params} as any}
function enable(){process.env.UPPULSE_PUBLIC_CATALOG_SOURCE="operational";process.env.UPPULSE_PUBLIC_CATALOG_APPROVED="true";process.env.AWIN_CURATOR_DATABASE_URL="configured"}
function disable(){delete process.env.UPPULSE_PUBLIC_CATALOG_SOURCE;delete process.env.UPPULSE_PUBLIC_CATALOG_APPROVED;delete process.env.AWIN_CURATOR_DATABASE_URL}

test("lista operacional encaminha filtros e ordenação separadamente",async()=>{enable();try{const res=response();await createOperationalPublicCatalogHandlers(()=>repo).list(request({limit:"20",offset:"20",sort:"price-asc",brand:"Marca",discountMin:"10"}),res,()=>assert.fail("não deveria cair no demo"));assert.equal(res.headers["X-UpPulse-Catalog-Source"],"operational");assert.equal(res.body.total,1);assert.equal(res.body.products[0].bestOffer.id,"o1");assert.equal(repo.filters.sort,"price-asc");assert.equal(repo.filters.brand,"Marca");assert.equal(repo.filters.discountMin,10)}finally{disable()}});
test("detalhe agrega ofertas e clique redireciona sem abrir destino",async()=>{enable();try{const handlers=createOperationalPublicCatalogHandlers(()=>repo),detail=response(),click=response();await handlers.detail(request({}, {id:"p1"}),detail,()=>assert.fail());await handlers.click(request({}, {offerId:"o1"}),click,()=>assert.fail());assert.equal(detail.body.id,"p1");assert.equal(detail.body.offers[0].id,"o1");assert.equal(click.redirectUrl,"https://affiliate.test/x")}finally{disable()}});
test("gate retirado devolve controle ao catálogo demo",async()=>{disable();let next=false;await createOperationalPublicCatalogHandlers(()=>repo).list(request(),response(),()=>{next=true});assert.equal(next,true)});
