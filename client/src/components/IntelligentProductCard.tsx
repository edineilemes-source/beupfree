import type {FieldAssessment} from "../../../server/productIntelligence/superCatalog";
import {createCustomerKnowledge} from "../../../server/productIntelligence/customerKnowledge";
import {brazilianTechnicalText} from "../../../server/productIntelligence/technicalPresentation";

type Props={brand:string;model:string;fields:readonly FieldAssessment[];experimental?:boolean};
const domain=(url:string)=>{try{return new URL(url).hostname.replace(/^www\./,"");}catch{return "Fonte";}};
export default function IntelligentProductCard({brand,model,fields,experimental=false}:Props){
 const knowledge=createCustomerKnowledge(fields);
 const visible=fields.filter(f=>f.sources?.length>0&&f.status!=="UNAVAILABLE");
 const sourceIndex=new Map(knowledge.sources.map((s,i)=>[s.url,i+1]));
 return <section className="space-y-4 rounded-lg border bg-background p-4 text-sm" aria-label="Ficha inteligente de produto" data-testid="intelligent-product-card">
  <div className="space-y-1">
   <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold">Ficha inteligente · {brand} {model}</h3>
    {experimental&&<span className="rounded border px-2 py-0.5 text-xs text-muted-foreground">Prévia experimental</span>}
   </div>
   <p className="text-xs text-muted-foreground">Síntese objetiva com referências. Dados podem variar conforme versão, tamanho ou medição.</p>
  </div>
  <div className="space-y-2">
   <h4 className="font-semibold">Visão geral</h4>
   <p data-testid="intelligent-summary">{knowledge.summary}</p>
  </div>
  <div className="space-y-2">
   <h4 className="font-semibold">Características técnicas</h4>
   {!knowledge.fields.length&&<p>As fontes disponíveis ainda não fornecem especificações técnicas verificáveis para esta identidade.</p>}
   <dl className="divide-y rounded-md border">
    {knowledge.fields.map(field=><div key={field.field} className="grid gap-1 px-3 py-2 sm:grid-cols-[135px_1fr]" data-testid={`customer-field-${field.field}`}>
     <dt className="font-medium">{field.label}</dt>
     <dd className="min-w-0 break-words">{field.summary}
      <span className="ml-1 inline-flex flex-wrap gap-1 align-baseline" aria-label="Referências">
       {field.citations.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"
        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        title={source.label} aria-label={`Fonte ${source.label}`}>[{sourceIndex.get(source.url)}]</a>)}
      </span>
      {field.alternatives>1&&<span className="ml-1 text-xs text-muted-foreground" title="As fontes divergem; nenhum valor foi escolhido automaticamente">· valores relatados</span>}
     </dd>
    </div>)}
   </dl>
   <p className="text-xs text-muted-foreground">{knowledge.notice}</p>
  </div>
  <details className="rounded-md border p-3" data-testid="intelligent-evidence-audit">
   <summary className="cursor-pointer font-semibold">Ver todas as fontes e detalhes técnicos</summary>
   <p className="mt-2 text-xs text-muted-foreground">Registro de auditoria: tradução de apresentação, texto original da fonte, datas, divergências e links individuais. A quantidade de fontes não determina automaticamente qual informação é correta.</p>
   <div className="mt-3 space-y-3">
    {visible.map(field=><article key={field.field} className="rounded border p-2">
     <strong>{field.field.replace(/_/g," ")} — {field.status==="CONFLICT"?"Divergências":"VERIFIED"===field.status?"Concordância":"Fonte única"}</strong>
     <ul className="mt-1 space-y-1 text-xs">{field.sources.map((s,i)=><li key={s.sourceUrl+s.value+i}>
      <span className="break-words">{brazilianTechnicalText(field.field,s.value)}</span>
      {brazilianTechnicalText(field.field,s.value)!==s.value&&<span className="block text-muted-foreground">Original: {s.value}</span>}
      {" · "}
      <a className="text-blue-600 hover:underline dark:text-blue-400" href={s.sourceUrl} target="_blank" rel="noopener noreferrer">{domain(s.sourceUrl)}</a>
      {Number.isFinite(Date.parse(s.observedAt))&&<span className="text-muted-foreground"> · {new Date(s.observedAt).toLocaleDateString("pt-BR")}</span>}
     </li>)}</ul>
    </article>)}
   </div>
   <h5 className="mt-3 font-semibold">Referências completas</h5>
   <ol className="mt-1 space-y-1 text-xs">{knowledge.sources.map((s,i)=><li key={s.url} className="break-words">
    [{i+1}] <a className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noopener noreferrer" href={s.url}>{s.label}</a>
   </li>)}</ol>
  </details>
 </section>;
}
