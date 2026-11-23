/** Deterministic AWIN curation decision. Reuses all historical master and taxonomy code.
 * Does not infer product equivalence or publish commercial offers.
 */
import type {NormalizedAwinItem} from "../integrations/awin/types";
import {parseProductIdentity} from "../../shared/product-identity/parser";
import {VERSIONS} from "../productIdentity/contracts";
import {assessAwinCatalogCandidate} from "../integrations/awin/catalogCandidate";
import {normalizeCatalogColour,normalizeCatalogSize} from "../integrations/awin/operationalCatalog";
import {classifyAudience} from "../integrations/awin/dafitiCuration";

export type AutomaticDecision={
 productKey:string;variantKey:string;offerKey:string;
 action:"STAGE"|"REJECT"|"REVIEW";
 reasons:string[];
 master:{brand:string|null;modelFamily:string|null;modelTokens:string[];version:string|null;ambiguities:string[];parserVersion:string};
 variant:{size:number|null;color:string[]|null;sizeStatus:string;colorStatus:string};
};
export function decideAutomaticCuration(item:NormalizedAwinItem):AutomaticDecision{
 const eligibility=assessAwinCatalogCandidate(item);
 const master=parseProductIdentity({
  name:item.product.name,brand:item.product.brand,
  ...(item.product.identifiers.gtin?{gtin:item.product.identifiers.gtin}:{}),
  ...(item.product.identifiers.mpn?{mpn:item.product.identifiers.mpn}:{}),
 });
 // A feed-supplied size without a verified measurement system is NOT a BR identity.
 const audience=classifyAudience({
  suitableFor:item.raw.payload["Fashion:suitable_for"],
  categoryPath:item.product.category.path,
  name:item.product.name
 });
 const size=normalizeCatalogSize(item.variant.size,audience);
 const color=normalizeCatalogColour(item.variant.colour);
 const reasons=[
  ...eligibility.eligibility.reasons.filter(v=>v!=="minimum_requirements_met"),
  ...master.ambiguities,
 ];
 const action=eligibility.eligibility.status==="OUT_OF_SCOPE_CONFIRMED"?"REJECT"
  :eligibility.eligibility.status==="REVIEW_REQUIRED"?"REVIEW":"STAGE";
 return {
  productKey:item.productKey,variantKey:item.variantKey,offerKey:item.offerKey,
  action,reasons:[...new Set(reasons)],
  master:{brand:master.master.brand,modelFamily:master.master.modelFamily,
   modelTokens:master.master.modelTokens,version:master.master.version,
   ambiguities:master.ambiguities,parserVersion:VERSIONS.parser},
  variant:{size:size.normalized,color:color.normalized,sizeStatus:size.status,colorStatus:color.status}
 };
}
