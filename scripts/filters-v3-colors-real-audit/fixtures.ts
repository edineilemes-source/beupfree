/** Synthetic auditor fixtures only; these are NOT observations about any real store. */
import type { ColorFrequency } from "./analysis";
export const COLOR_FIXTURE: ColorFrequency[] = [
  ["preto",10], ["café",8], ["cafe",4], ["pink",3], ["rosa",2],
  ["azul marinho",5], ["azul-marinho",3],
].map(([value,frequency])=>({source:"projection",value:String(value),frequency:Number(frequency),
  products:Number(frequency),variants:null,merchants:1}));
export const UNKNOWN_MERCHANT_FIXTURE = {
  scope:"merchant",scope_id:"merchant-new",name:"New Independent Shop",provider_id:"provider-new",
  external_merchant_id:"opaque-merchant",products:7,variants:12,projection_rows:7,
};
