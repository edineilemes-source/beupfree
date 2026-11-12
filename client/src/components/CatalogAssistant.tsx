import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseCatalogIntent, catalogAssistantParams, assistantExplanation, type CatalogIntent } from "@/lib/catalogAssistant";

type Offer = { affiliateUrl?:string; currentPrice?:string|number; marketplaceName?:string; discountPercent?:number };
type Product = { id:string;mainName:string;mainImageUrl?:string;bestOffer?:Offer;demonstrative?:boolean };
type Response = { catalogSource:string;demonstrative?:boolean;products:Product[] };
const money=(n:string|number|undefined)=>Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export default function CatalogAssistant({open,onOpenChange,initialQuery=""}:{
  open:boolean;onOpenChange:(open:boolean)=>void;initialQuery?:string
}) {
  const [draft,setDraft]=useState("");
  const [intent,setIntent]=useState<CatalogIntent>({});
  const [products,setProducts]=useState<Product[]>([]);
  const [status,setStatus]=useState<"idle"|"loading"|"results"|"empty"|"unavailable"|"error">("idle");
  const [history,setHistory]=useState<string[]>([]);
  useEffect(()=>{if(open && initialQuery && !history.length)setDraft(initialQuery);},[open,initialQuery,history.length]);
  async function consult(text:string){
    const input=text.trim();if(!input)return;
    const next=parseCatalogIntent(input,intent);
    setIntent(next);setHistory(previous=>[...previous.slice(-7),input]);
    setDraft("");setStatus("loading");setProducts([]);
    if(!next.brand&&!next.activity&&!next.priceMax&&!next.size){setStatus("idle");return;}
    try{
      const response=await fetch("/api/products?"+catalogAssistantParams(next).toString(),{headers:{accept:"application/json"}});
      if(!response.ok)throw Error("CATALOG_UNAVAILABLE");
      const data:Response=await response.json();
      if(data.catalogSource!=="operational"||data.demonstrative){setStatus("unavailable");return;}
      const eligible=(data.products??[]).filter(item=>!item.demonstrative && item.bestOffer?.affiliateUrl && /^https?:\/\//.test(item.bestOffer.affiliateUrl) && Number.isFinite(Number(item.bestOffer.currentPrice)));
      setProducts(eligible);setStatus(eligible.length?"results":"empty");
    }catch{setStatus("error");}
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="catalog-assistant">
      <DialogHeader>
        <DialogTitle>Consultor UpPulse — escolha seu tênis</DialogTitle>
        <DialogDescription>Busca guiada no catálogo real. Não usa IA generativa nem serviços pagos; só recomenda ofertas elegíveis.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <p className="text-sm">Conte sua necessidade. Exemplo: “Quero Adidas para correr, até R$ 500, tamanho 41”.</p>
        {history.map((message,index)=><p key={index} className="rounded bg-muted p-2 text-sm">Você: {message}</p>)}
        <form className="flex gap-2" onSubmit={event=>{event.preventDefault();void consult(draft);}}>
          <Input value={draft} onChange={e=>setDraft(e.target.value)} aria-label="Converse com o consultor de tênis" placeholder="Marca, uso, preço e numeração…" maxLength={300}/>
          <Button type="submit" disabled={!draft.trim() || status==="loading"}>Consultar</Button>
        </form>
        {status==="idle"&&<p className="text-sm">Qual marca, modalidade, faixa de preço ou numeração você procura?</p>}
        {status==="loading"&&<p role="status">Consultando produtos publicáveis…</p>}
        {status==="unavailable"&&<p role="alert">O catálogo operacional não está ativo. Para evitar sugestões demonstrativas, nenhuma recomendação foi exibida.</p>}
        {status==="error"&&<p role="alert">Não foi possível consultar o catálogo agora. Tente novamente.</p>}
        {status==="empty"&&<p role="status">Não encontrei ofertas elegíveis com esses critérios. Tente outra marca, modalidade, preço ou tamanho.</p>}
        {status==="results"&&<>
          <p className="text-sm">Encontrei {products.length} opções para você avaliar. {intent.activity==="Trilha"?"A categoria trilha ainda não é filtrada especificamente. ":""}Não há garantia de que a primeira opção seja a melhor para sua biomecânica.</p>
          <div className="space-y-3">{products.map(product=><article key={product.id} className="flex gap-3 rounded border p-3" data-testid="assistant-result">
            {product.mainImageUrl&&<img src={product.mainImageUrl} alt="" className="h-20 w-20 shrink-0 object-contain"/>}
            <div className="min-w-0 space-y-1 text-sm">
              <p className="font-semibold">{product.mainName}</p>
              <p>{money(product.bestOffer?.currentPrice)} · {product.bestOffer?.marketplaceName??"Loja parceira"}</p>
              <p className="text-xs text-muted-foreground">{assistantExplanation(intent,product)}</p>
              <a className="inline-block underline" href={product.bestOffer?.affiliateUrl} target="_blank" rel="noopener noreferrer">Ver oferta na loja</a>
            </div>
          </article>)}</div>
          <p className="text-sm">Quer refinar? Informe outro limite de preço, numeração, marca ou modalidade.</p>
        </>}
      </div>
    </DialogContent>
  </Dialog>;
}
