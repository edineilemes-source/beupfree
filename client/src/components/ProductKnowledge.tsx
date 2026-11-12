import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import type { KnowledgeCard } from "../../../server/productIntelligence/superCatalog";

type Payload = {
  status: "IDENTITY_ONLY" | "CACHED_ENRICHED";
  catalogSource: "operational";
  brand: string;
  model: string;
  card: KnowledgeCard;
  researchPaidEnabled: false;
};
export default function ProductKnowledge({ productId }: { productId: string }) {
  const query = useQuery<Payload>({
    queryKey: ["product-knowledge", productId],
    queryFn: async () => {
      const res = await fetch("/api/product-knowledge/" + encodeURIComponent(productId));
      if (!res.ok) throw new Error("KNOWLEDGE_UNAVAILABLE");
      return res.json();
    },
    retry: false,
  });
  if (query.isPending) return <p role="status">Consultando identidade técnica…</p>;
  if (query.isError) return <p role="alert">Ficha inteligente indisponível neste ambiente. O catálogo e as ofertas continuam acessíveis.</p>;
  const {card} = query.data;
  const fields = card.fields.filter(x => x.status !== "UNAVAILABLE");
  return <section className="space-y-3 text-sm" aria-label="Ficha inteligente UpPulse" data-testid="product-knowledge">
    <div className="flex flex-wrap items-center gap-2"><strong>Ficha inteligente</strong>
      <Badge variant="outline">{query.data.status === "CACHED_ENRICHED" ? "Evidências em cache" : "Identidade calculada"}</Badge>
      <Badge variant="outline">Sem chamadas pagas</Badge>
    </div>
    <p>{query.data.brand} — {query.data.model}</p>
    <dl className="grid grid-cols-1 gap-2 rounded border p-3">
      {([["Master ID",card.masterId],["SuperHash",card.superHash],["Family Key",card.familyKey],["Model Key",card.modelKey],["Variant Key",card.variantKey ?? "Não definida"]] as const).map(([name,value]) =>
        <div key={name} className="min-w-0"><dt className="font-semibold">{name}</dt><dd className="break-all font-mono text-xs" data-testid={name === "SuperHash" ? "product-superhash" : undefined}>{value}</dd></div>)}
    </dl>
    <h4 className="font-semibold">Especificações e evidências ({fields.length})</h4>
    {!fields.length && <p>Sem evidências externas validadas. A pesquisa paga permanece desativada; nenhuma característica será inventada.</p>}
    {fields.map(field => <article key={field.field} className="rounded border p-2">
      <strong className="capitalize">{field.field.replace(/_/g," ")}</strong>: {field.value ?? "Valores divergentes"}
      <p className="text-xs">{({VERIFIED:"Verificado por fontes distintas",SINGLE_SOURCE:"Uma fonte",CONFLICT:"Fontes conflitantes",UNAVAILABLE:"Não disponível"} as const)[field.status]}</p>
      <ul>{field.sources.map(source => <li key={source.sourceUrl + source.value} className="break-all text-xs">
        <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">Fonte: {new URL(source.sourceUrl).hostname}</a> — {new Date(source.observedAt).toLocaleDateString("pt-BR")}
      </li>)}</ul>
    </article>)}
  </section>;
}
