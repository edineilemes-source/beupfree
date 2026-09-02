export const catalogPreviewSorts = ["recommended", "discount-desc", "discount-asc", "price-asc", "price-desc", "name-asc", "brand-asc"] as const;
export type CatalogPreviewSort = typeof catalogPreviewSorts[number];
export interface CatalogPreviewVariant { id:string; sizeRaw:string|null; sizeNormalized:number|null; colorRaw:string|null; colorNormalized:string[]|null; available:boolean }
export interface CatalogPreviewProduct {
  id:string; brand:string; name:string; description:string|null; audience:"MASCULINO"|"FEMININO"|"UNISSEX"|"INFANTIL"|"UNKNOWN";
  taxonomy:{universe:string;style:string;activities:string[];confidence:string};
  pricing:{currentPrice:number;previousPrice:number;discountPercent:number;currency:string};
  variants:CatalogPreviewVariant[]; normalizedSizes:number[]; normalizedColors:string[]; primaryImage:string|null; images:string[];
  merchant:{id:string;name:string}; affiliateUrl:string; representativeOfferId:string;
}
export interface CatalogPreviewFacet { value:string; count:number }
export interface CatalogPreviewFacets { brands:CatalogPreviewFacet[]; audiences:CatalogPreviewFacet[]; sizes:CatalogPreviewFacet[]; styles:CatalogPreviewFacet[]; activities:CatalogPreviewFacet[]; merchants:CatalogPreviewFacet[]; colors:CatalogPreviewFacet[] }
export interface CatalogPreviewResponse { items:CatalogPreviewProduct[]; pagination:{page:number;pageSize:number;totalProducts:number;totalPages:number}; diagnostics:{queryMs:number;totalMs:number;roundTrips:number;queryTimings:{productsMs:number;countMs:number;detailsMs:number}} }
export interface CatalogPreviewFacetsResponse { facets:CatalogPreviewFacets; diagnostics:{queryMs:number;totalMs:number;roundTrips:number;cached:boolean} }
