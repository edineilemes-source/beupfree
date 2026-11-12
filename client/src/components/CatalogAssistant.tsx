import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  interpretCatalogRequest, catalogAssistantParams, catalogFilterLabels, hasCatalogIntent,
  assistantExplanation, type CatalogIntent,
} from "@/lib/catalogAssistant";

type Offer = { affiliateUrl?:string; currentPrice?:string|number; marketplaceName?:string; discountPercent?:number };
type Product = { id:string;mainName:string;mainImageUrl?:string;bestOffer?:Offer;demonstrative?:boolean; verifiedEvidence?:Array<{field:string;value:string;status:"VERIFIED"|"SINGLE_SOURCE"}> };
type Response = { catalogSource:string;demonstrative?:boolean;total?:number;products:Product[];technicalSource?:string;notice?:string };
type Status = "idle"|"loading"|"results"|"empty"|"unavailable"|"error"|"not-understood"|"unsupported";
const money=(n:string|number|undefined)=>Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export default function CatalogAssistant({open,onOpenChange,initialQuery=""}:{
  open:boolean;onOpenChange:(open:boolean)=>void;initialQuery?:string
}) {
  const [draft,setDraft]=useState("");
  const [intent,setIntent]=useState<CatalogIntent>({});
  const [products,setProducts]=useState<Product[]>([]);
  const [total,setTotal]=useState<number|null>(null);
  const [status,setStatus]=useState<Status>("idle");
  const [history,setHistory]=useState<string[]>([]);
  const [lastMode,setLastMode]=useState<"new"|"refine">("new");
  const [warning,setWarning]=useState("");
  const requestVersion=useRef(0);
  // Never repopulate this form from an old catalog URL or prior conversation.
  function newSearch(){
    requestVersion.current++;
    setIntent({});setDraft("");setHistory([]);setProducts([]);setTotal(null);
    setWarning("");setStatus("idle");setLastMode("new");
  }
  async function consult(text:string){
    const input=text.trim();if(!input)return;
    const parsed=interpretCatalogRequest(input,intent);
    setHistory(previous=>[...previous.slice(-7),input]);
    setDraft("");
    if(!parsed.recognized || !hasCatalogIntent(parsed.intent)){
      requestVersion.current++;
      setIntent({});setProducts([]);setTotal(null);setWarning("");
      setStatus("not-understood");
      return;
    }
    setIntent(parsed.intent);setLastMode(parsed.mode);
    setWarning(parsed.unsupported.join(" "));
    setProducts([]);setTotal(null);
    if(parsed.unsupported.length){
      requestVersion.current++;setStatus("unsupported");return;
    }
    setStatus("loading");
    const version=++requestVersion.current;
    try{
      const query=catalogAssistantParams(parsed.intent);
      const url=parsed.intent.technical?.length ? "/api/assistant/technical/search?" : "/api/products?";
      const response=await fetch(url+query.toString(),{headers:{accept:"application/json"}});
      if(!response.ok)throw Error("CATALOG_UNAVAILABLE");
      const data:Response=await response.json();
      if(version!==requestVersion.current)return;
      if(data.catalogSource!=="operational"||data.demonstrative){setStatus("unavailable");return;}
      const eligible=(data.products??[]).filter(item=>
        !item.demonstrative && Boolean(item.bestOffer?.affiliateUrl) &&
        /^https?:\/\//.test(item.bestOffer?.affiliateUrl??"") &&
        Number.isFinite(Number(item.bestOffer?.currentPrice)) && Number(item.bestOffer?.currentPrice)>0
      );
      setTotal(Number.isInteger(data.total)&&Number(data.total)>=0 ? Number(data.total):null);
      setProducts(eligible);setStatus(eligible.length?"results":"empty");
    }catch{if(version===requestVersion.current)setStatus("error");}
  }
  function handleOpenChange(next:boolean){
    if(!next)newSearch();
    onOpenChange(next);
  }
  return <Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="catalog-assistant">
      <DialogHeader>
        <DialogTitle>Consultor UpPulse — escolha seu tênis <span className="text-xs font-normal text-muted-foreground" data-testid="assistant-version">v11.1.3</span></DialogTitle>
        <DialogDescription>Busca guiada no catálogo real, sem IA generativa ou serviços pagos. Os critérios e a quantidade encontrada são exibidos abaixo.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">Exemplo: “Adidas para corrida até R$ 500 tamanho 41”. Para mudar apenas o preço ou o tamanho, envie outra mensagem. Para trocar marca ou esporte, iniciaremos uma busca nova.</p>
          <Button type="button" variant="outline" onClick={newSearch} data-testid="assistant-new-search">Nova pesquisa</Button>
        </div>
        {history.map((message,index)=><p key={index} className="rounded bg-muted p-2 text-sm">Você: {message}</p>)}
        <form className="flex gap-2" onSubmit={event=>{event.preventDefault();void consult(draft);}}>
          <Input value={draft} onChange={e=>setDraft(e.target.value)} aria-label="Converse com o consultor de tênis" placeholder="Marca, uso, preço e numeração…" maxLength={300}/>
          <Button type="submit" disabled={!draft.trim() || status==="loading"}>Consultar</Button>
        </form>
        {hasCatalogIntent(intent)&&status!=="idle"&&<section className="rounded border p-3 text-sm" aria-label="Critérios da consulta" data-testid="assistant-query-info">
          <p data-testid="assistant-query-mode">{lastMode==="refine"?"Refinamento da pesquisa anterior":"Nova pesquisa"}</p>
          <p className="font-semibold">Filtros realmente aplicados:</p>
          <ul className="list-inside list-disc" data-testid="assistant-applied-filters">
            {catalogFilterLabels(intent).map(label=><li key={label}>{label}</li>)}
          </ul>
          {total!==null&&<p className="mt-2" data-testid="assistant-total">Total informado pelo catálogo: {total.toLocaleString("pt-BR")} produtos. Exibindo até 6 ofertas por pesquisa.</p>}
          {warning&&<p role="alert">{warning}</p>}
        </section>}
        {status==="idle"&&<p className="text-sm">Qual marca, modalidade, faixa de preço ou numeração você procura?</p>}
        {status==="not-understood"&&<p role="status" data-testid="assistant-not-understood">Não reconheci filtros nessa mensagem e não repeti a busca anterior. Informe marca, corrida/caminhada/treino, preço máximo ou numeração.</p>}
        {status==="unsupported"&&<p role="status">Essa modalidade ainda não possui filtro confiável no catálogo; não vou mostrar produtos sem aplicar o critério pedido.</p>}
        {status==="loading"&&<p role="status">Consultando produtos publicáveis…</p>}
        {status==="unavailable"&&<p role="alert">O catálogo operacional não está ativo. Para evitar sugestões demonstrativas, nenhuma recomendação foi exibida.</p>}
        {status==="error"&&<p role="alert">Não foi possível consultar o catálogo agora. Tente novamente.</p>}
        {status==="empty"&&<p role="status">{intent.technical?.length ? "Nenhuma oferta com evidências técnicas já cadastradas corresponde a esses termos. Isso não significa que os demais tênis não tenham essas características. O enriquecimento externo ainda não foi executado para todos os produtos." : "Não encontrei ofertas elegíveis com esses critérios. Tente outra marca, modalidade, preço ou tamanho."}</p>}
        {status==="results"&&<>
          <p className="text-sm">Exibindo {products.length} ofertas dos produtos retornados pela consulta. {intent.technical?.length?"Busca técnica realizada apenas nas evidências armazenadas na ficha, sem pesquisa externa. ":""}Não há garantia de que a primeira opção seja a melhor para sua biomecânica.</p>
          <div className="space-y-3">{products.map(product=><article key={product.id} className="flex gap-3 rounded border p-3" data-testid="assistant-result">
            {product.mainImageUrl&&<img src={product.mainImageUrl} alt="" className="h-20 w-20 shrink-0 object-contain"/>}
            <div className="min-w-0 space-y-1 text-sm">
              <p className="font-semibold">{product.mainName}</p>
              <p>{money(product.bestOffer?.currentPrice)} · {product.bestOffer?.marketplaceName??"Loja parceira"}</p>
              <p className="text-xs text-muted-foreground">{assistantExplanation(intent,product)}</p>
              {product.verifiedEvidence?.map((f,index)=><p className="text-xs" data-testid="assistant-evidence" key={f.field+index}><strong>{f.field.replace(/_/g," ")}:</strong> {f.value} · {f.status==="VERIFIED"?"Verificado por mais de uma fonte":"Fonte única"}</p>)}
              <a className="inline-block underline" href={product.bestOffer?.affiliateUrl} target="_blank" rel="noopener noreferrer">Ver oferta na loja</a>
            </div>
          </article>)}</div>
          <p className="text-sm">Quer refinar? Informe outro limite de preço ou numeração; para trocar marca ou modalidade, faça uma nova pergunta.</p>
        </>}
      </div>
    </DialogContent>
  </Dialog>;
}
