import test from "node:test";
import assert from "node:assert/strict";
import {masterParserPreview} from "./masterParserPreview";
import {parseProductIdentity} from "../../shared/product-identity/parser";
import {VERSIONS} from "../productIdentity/contracts";
test("Curadoria chama o parser histórico exato para nome/modelo/versão, sem recriar regras",()=>{
 const input={externalIdentityId:"e1",productId:"p1",productName:"Tênis Olympikus Corre 4 Masculino Preto",
  brandName:"Olympikus",variantId:"v1",sizeRaw:"40",colorRaw:"Preto",gtin:null,mpn:null};
 const source=parseProductIdentity({name:input.productName,brand:input.brandName,size:{value:"40",system:"BR"}});
 const preview=masterParserPreview(input);
 assert.deepEqual(preview.identity.master,source.master);
 assert.deepEqual(preview.identity.variant,source.variant);
 assert.equal(preview.parserVersion,VERSIONS.parser);
 assert.equal(preview.matcherVersion,VERSIONS.matcher);
 assert.equal(preview.normalization.size.normalized,40);
 assert.equal(preview.action,"PREVIEW_ONLY");
 assert.equal(preview.merged,false);
 assert.equal(preview.published,false);
});
test("ausência de cor/tamanho permanece informação incompleta, nunca dado fabricado",()=>{
 const preview=masterParserPreview({externalIdentityId:"e",productId:"p",
  productName:"Tênis Olympikus",brandName:null,variantId:null,
  sizeRaw:null,colorRaw:null,gtin:null,mpn:null});
 assert.equal(preview.normalization.size.normalized,null);
 assert.equal(preview.normalization.color.raw,null);
 assert.equal(preview.published,false);
});
