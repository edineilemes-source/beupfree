export interface MasterIdentityView {
 status:'AVAILABLE'|'NO_CONFIRMED_IDENTITY';
 master?:{id:string;canonicalName:string|null;canonicalNameStatus:string;brand:string|null;productType:string|null;modelFamily:string|null;modelTokens:string[];generation:string|null;technicalQualifiers:string[]};
 equivalenceScope?:'MASTER_ONLY';skuEquivalence?:false;
 members?:Array<{product_id:string;external_identity_id:string;provider_id:string;merchant_id:string;main_name:string;assignment_method:'AUTO_MATCH'|'SINGLETON';run_id:string;variants:Array<{id:string;size?:string|null;colour?:string|null;gtin?:string|null;mpn?:string|null}>}>;
 offers?:Array<{product_id:string;provider_id:string;merchant_id:string;offer_id:string;product_name:string;current_price:string;previous_price:string;discount_percent:string;currency:string;normalized_sizes:number[];normalized_colors:string[];merchant_name:string;affiliate_url:string}>;
}
