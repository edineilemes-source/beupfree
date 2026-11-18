/**
 * Ponte read-only para a Curadoria V3.
 * Usa o parser HISTÓRICO do Produto Mestre sem copiar/alterar regra nenhuma.
 * Não decide igualdade, não cria identidade, não grava nem publica.
 */
import {parseProductIdentity} from "../../shared/product-identity/parser";
import {normalizeCatalogSize,normalizeCatalogColour} from "../integrations/awin/operationalCatalog";
import {VERSIONS} from "../productIdentity/contracts";

export type FeedMasterPreviewRow={
 externalIdentityId:string;productId:string;productName:string;brandName:string|null;
 variantId:string|null;sizeRaw:string|null;colorRaw:string|null;gtin:string|null;mpn:string|null;
};
export function masterParserPreview(row:FeedMasterPreviewRow){
 const original=parseProductIdentity({
  name:row.productName,brand:row.brandName,
  ...(row.sizeRaw?{size:{value:row.sizeRaw,system:"BR"}}:{}),
  ...(row.gtin?{gtin:row.gtin}:{}),
  ...(row.mpn?{mpn:row.mpn}:{})
 });
 const normalizedSize=normalizeCatalogSize(row.sizeRaw);
 const normalizedColor=normalizeCatalogColour(row.colorRaw);
 return {
  externalIdentityId:row.externalIdentityId,productId:row.productId,
  variantId:row.variantId,rawName:row.productName,
  parserVersion:VERSIONS.parser,matcherVersion:VERSIONS.matcher,
  identity:{master:original.master,variant:original.variant,ambiguities:original.ambiguities},
  normalization:{size:normalizedSize,color:{
   raw:normalizedColor.raw,normalized:normalizedColor.normalized,
   status:normalizedColor.status,reasonCode:normalizedColor.reasonCode
  }},
  action:"PREVIEW_ONLY" as const,
  merged:false,published:false
 };
}
