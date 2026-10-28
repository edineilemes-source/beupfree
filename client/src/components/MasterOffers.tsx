import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import type {MasterIdentityView} from '@shared/masterIdentity';
const money=(value:string)=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function MasterOffers({productId}:{productId:string}){
 const [open,setOpen]=useState(false);
 const query=useQuery<MasterIdentityView>({queryKey:['master-identity',productId],enabled:open,retry:1,
  queryFn:async()=>{const response=await fetch(`/api/master-identities/${encodeURIComponent(productId)}`);if(!response.ok)throw Error('IDENTITY_UNAVAILABLE');return response.json();}});
 const data=query.data,master=data?.master;
 return <>
  <Button type="button" variant="outline" className="mt-2 w-full" onClick={()=>setOpen(true)} data-testid={`master-offers-${productId}`}>Modelo e fornecedores</Button>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" data-testid="master-dialog">
   <DialogHeader><DialogTitle>Identidade e ofertas do modelo</DialogTitle><DialogDescription>O mesmo modelo pode ter cores e tamanhos diferentes. Confira a variante na loja.</DialogDescription></DialogHeader>
   {query.isPending&&<p role="status">Carregando identidade…</p>}
   {query.isError&&<div role="alert">Identidade temporariamente indisponível. As ofertas do catálogo continuam disponíveis.<Button variant="outline" onClick={()=>query.refetch()}>Tentar novamente</Button></div>}
   {data?.status==='NO_CONFIRMED_IDENTITY'&&<p>Não há identidade confirmada disponível para este produto.</p>}
   {master&&<div className="space-y-4 text-sm">
    <div><p className="font-semibold">Master {master.id}</p>
     {master.canonicalName?<p>{master.canonicalName}</p>:<p className="text-muted-foreground">Nome comercial Master não disponível.</p>}
     <dl className="mt-2 grid grid-cols-2 gap-1"><dt>Marca</dt><dd>{master.brand??'Não informada'}</dd>
      <dt>Família técnica</dt><dd>{master.modelFamily??'Não identificada'}</dd>
      <dt>Tokens do modelo</dt><dd>{master.modelTokens.join(' ')||'Não identificados'}</dd>
      <dt>Geração</dt><dd>{master.generation??'Não identificada'}</dd>
      <dt>Qualificadores</dt><dd>{master.technicalQualifiers.join(', ')||'Não identificados'}</dd></dl>
    </div>
    <p>Identidade do modelo confirmada. A equivalência de SKU não foi estabelecida.</p>
    <section aria-label="Ofertas por fornecedor"><h3 className="font-semibold">Ofertas por fornecedor</h3>
     {!data.offers?.length&&<p>Sem ofertas promocionais disponíveis.</p>}
     <div className="space-y-3">{data.offers?.map(offer=><article key={offer.offer_id} className="rounded-md border p-3" data-testid="master-offer">
      <h4 className="font-semibold">{offer.merchant_name}</h4><p>{offer.product_name}</p>
      <p><strong>{money(offer.current_price)}</strong> <s>{money(offer.previous_price)}</s> · {Number(offer.discount_percent)}% de desconto</p>
      <p>Cores: {offer.normalized_colors.join(', ')||'Não informadas'} · Tamanhos: {offer.normalized_sizes.join(', ')||'Não informados'}</p>
      <a className="mt-2 inline-block underline" href={offer.affiliate_url} target="_blank" rel="noopener noreferrer">Ver oferta em {offer.merchant_name}</a>
     </article>)}</div>
    </section>
    <section aria-label="Hierarquia e variantes"><h3 className="font-semibold">Hierarquia e variantes de origem</h3>
     {data.members?.map(member=><details key={member.external_identity_id} className="mt-2 rounded border p-2"><summary>{member.main_name} · {member.variants.length} variantes</summary>
      <p className="break-all">Produto de origem: {member.product_id}</p>
      <ul className="pl-4 list-disc">{member.variants.slice(0,20).map(variant=><li key={variant.id}>{variant.colour??'Cor não informada'} · {variant.size??'Tamanho não informado'}</li>)}</ul>
      {member.variants.length>20&&<p>Exibindo 20 de {member.variants.length} variantes de origem.</p>}
     </details>)}
    </section>
   </div>}
  </DialogContent></Dialog>
 </>;
}
