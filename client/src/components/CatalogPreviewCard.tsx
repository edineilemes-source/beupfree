import React, { useState } from "react";
import type { CatalogPreviewProduct } from "@shared/catalogPreview";
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
export default function CatalogPreviewCard({product}:{product:CatalogPreviewProduct}){
 const [broken,setBroken]=useState(false);
 const sizes=Array.from(new Set(product.normalizedSizes.map(String)));
 const colors=Array.from(new Set(product.normalizedColors));
 return <article className="flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm" data-testid={`preview-card-${product.id}`}>
  <div className="flex h-52 items-center justify-center bg-slate-50">{product.primaryImage&&!broken?<img src={product.primaryImage} alt={product.name} onError={()=>setBroken(true)} className="h-full w-full object-contain p-3"/>:<div className="text-sm text-slate-500" data-testid="image-fallback">Imagem indisponível</div>}</div>
  <div className="flex flex-1 flex-col gap-2 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{product.brand}</p><h2 className="line-clamp-2 min-h-10 text-sm font-semibold">{product.name}</h2><div><p className="text-xs text-slate-500 line-through">De {money.format(product.pricing.previousPrice)}</p><p className="text-xl font-extrabold">Por {money.format(product.pricing.currentPrice)}</p><p className="font-bold text-emerald-700">{Math.round(product.pricing.discountPercent)}% OFF</p></div><p className="text-xs"><b>{product.merchant.name}</b> · {product.audience}</p><p className="text-xs"><b>Tamanhos:</b> {sizes.length?sizes.join(", "):"não disponíveis com segurança"}</p><p className="text-xs"><b>Cores:</b> {colors.length?`${colors.slice(0,3).join(", ")}${colors.length>3?` +${colors.length-3}`:""}`:"não normalizadas"}</p><p className="mt-auto text-xs text-slate-600">{product.taxonomy.style}{product.taxonomy.activities.length?` · ${product.taxonomy.activities.join(", ")}`:""}</p></div>
 </article>;
}
