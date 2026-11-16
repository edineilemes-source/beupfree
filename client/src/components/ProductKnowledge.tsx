import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import EvoSlPilot from "./EvoSlPilot";
import IntelligentProductCard from "./IntelligentProductCard";
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
  return <section className="space-y-3 text-sm" aria-label="Ficha inteligente UpPulse" data-testid="product-knowledge">
    <div className="flex flex-wrap items-center gap-2"><strong>Ficha inteligente</strong>
      <Badge variant="outline">{query.data.status === "CACHED_ENRICHED" ? "Evidências em cache" : "Identidade calculada"}</Badge>
      <Badge variant="outline">Sem chamadas pagas</Badge>
    </div>
    <p>{query.data.brand} — {query.data.model}</p>
    <IntelligentProductCard brand={query.data.brand} model={query.data.model} fields={card.fields}/>
    <details className="rounded border p-3"><summary className="cursor-pointer font-semibold">Identificadores internos do produto</summary>
    <dl className="mt-3 grid grid-cols-1 gap-2">
      {([["Master ID",card.masterId],["SuperHash",card.superHash],["Family Key",card.familyKey],["Model Key",card.modelKey],["Variant Key",card.variantKey ?? "Não definida"]] as const).map(([name,value]) =>
        <div key={name} className="min-w-0"><dt className="font-semibold">{name}</dt><dd className="break-all font-mono text-xs" data-testid={name === "SuperHash" ? "product-superhash" : undefined}>{value}</dd></div>)}
    </dl></details>
    {import.meta.env.DEV&&<EvoSlPilot/>}
  </section>;
}
