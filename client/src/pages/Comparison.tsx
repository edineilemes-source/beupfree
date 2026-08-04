import {
  ArrowLeft,
  Check,
  ChevronRight,
  Flame,
  PackageX,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Trophy,
  Truck,
  WalletCards,
} from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useComparison } from "@/context/ComparisonContext";
import {
  analyzeComparison,
  type CriterionLeader,
  type ScoredProduct,
} from "@/features/comparison-intelligence/comparisonIntelligence";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("pt-BR");

function leaderLabel(leader: CriterionLeader): string {
  if (leader.products.length === 0) return "—";
  return leader.products.map((product) => product.label).join(" e ");
}

function MetricRow({ label, values, format }: { label: string; values: ScoredProduct[]; format: (item: ScoredProduct) => string }) {
  return (
    <div className="grid min-w-[620px] grid-cols-[150px_repeat(3,minmax(140px,1fr))] border-t border-slate-200 py-4 first:border-t-0">
      <div className="pl-5 text-sm font-medium text-slate-500">{label}</div>
      {values.map((item) => <div key={item.product.id} className="px-4 text-center text-sm font-bold text-slate-900">{format(item)}</div>)}
      {Array.from({ length: 3 - values.length }).map((_, index) => <div key={index} />)}
    </div>
  );
}

function EmptyState({ one, onBack }: { one?: boolean; onBack: () => void }) {
  return (
    <Card className="mx-auto max-w-3xl border-0 p-10 text-center shadow-sm">
      <PackageX className="mx-auto mb-4 h-11 w-11 text-slate-400" />
      <p className="text-xl font-bold">{one ? "Selecione mais um produto para comparar." : "Nenhum produto selecionado para comparação."}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Adicione de dois a três produtos e nós analisamos qual oferece o melhor custo-benefício.</p>
      <Button className="mt-6 gap-2" onClick={onBack} data-testid={one ? "button-continue-shopping" : "button-back-to-catalog"}><ArrowLeft className="h-4 w-4" />{one ? "Continuar comprando" : "Voltar ao catálogo"}</Button>
    </Card>
  );
}

export default function Comparison() {
  const { items, comparisonCount, clearComparison, removeFromComparison } = useComparison();
  const [, setLocation] = useLocation();
  const intelligence = useMemo(() => analyzeComparison(items), [items]);
  const { products: scored, winner, scoreLeaders, isScoreTie, worthPaying } = intelligence;
  const featured = winner ?? scoreLeaders[0];

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6f5]">
      <Header />
      <main className="flex-1 px-4 py-10 md:px-8 md:py-14">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-primary"><Sparkles className="h-4 w-4" />Análise UpPulse</div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl" data-testid="comparison-page-title">Comparação inteligente</h1>
              <p className="mt-2 text-sm text-slate-500">Dados traduzidos em uma escolha simples e segura.</p>
            </div>
            {comparisonCount > 0 && <Button variant="ghost" className="text-slate-500" onClick={clearComparison} data-testid="button-clear-comparison-page">Limpar</Button>}
          </div>

          {comparisonCount < 2 ? <EmptyState one={comparisonCount === 1} onBack={() => setLocation("/catalogo")} /> : (
            <div className="space-y-6">
              <Card className="overflow-hidden border-0 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <div className="grid min-w-[620px] grid-cols-[150px_repeat(3,minmax(140px,1fr))]" data-testid="comparison-products-grid">
                    <div />
                    {scored.map((item) => (
                      <div key={item.product.id} className={`relative px-4 pb-6 pt-7 text-center ${scoreLeaders.some((leader) => leader.product.id === item.product.id) ? "bg-emerald-50/80" : ""}`} data-testid={`comparison-page-card-${item.product.id}`}>
                        {scoreLeaders.some((leader) => leader.product.id === item.product.id) && <div className="absolute inset-x-0 top-0 h-1 bg-primary" />}
                        <button onClick={() => removeFromComparison(item.product.id)} className="absolute right-2 top-2 rounded-full p-1.5 text-slate-300 transition hover:bg-white hover:text-red-500" aria-label={`Remover ${item.product.title}`} data-testid={`button-remove-comparison-page-${item.product.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                        <div className="mx-auto mb-3 flex h-20 w-24 items-center justify-center rounded-xl bg-white p-2">
                          {item.product.imageUrl ? <img src={item.product.imageUrl} alt="" className="h-full w-full object-contain" /> : <PackageX className="h-7 w-7 text-slate-300" />}
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
                        <p className="mt-1 line-clamp-2 h-10 text-sm font-semibold leading-5 text-slate-900">{item.product.title}</p>
                        <div className="mt-4 flex items-end justify-center gap-1"><span className="text-3xl font-black text-slate-950">{item.score.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span><span className="mb-1 text-xs font-semibold text-slate-400">/10</span></div>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Nota UpPulse</p>
                        {scoreLeaders.some((leader) => leader.product.id === item.product.id) && <div className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white"><Trophy className="h-3 w-3" />{isScoreTie ? "Empate técnico" : "Melhor escolha"}</div>}
                      </div>
                    ))}
                  </div>
                  <div className="min-w-[620px] border-y border-slate-200 bg-slate-50/70 px-6 py-5 text-center">
                    <p className="text-xs font-black uppercase tracking-[.16em] text-primary">Por que recomendamos</p>
                    <p className="mt-1 text-sm font-medium text-slate-700">{intelligence.recommendationReason}</p>
                  </div>
                  <MetricRow label="Preço" values={scored} format={(item) => item.selectedOffer?.currentPrice ? money.format(item.selectedOffer.currentPrice) : "—"} />
                  <MetricRow label="Desconto" values={scored} format={(item) => item.selectedOffer?.discountPercent != null ? `${item.selectedOffer.discountPercent}%` : "—"} />
                  <MetricRow label="Avaliação" values={scored} format={(item) => item.product.rating?.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) ?? "—"} />
                  <MetricRow label="Avaliações" values={scored} format={(item) => item.product.reviewCount != null ? number.format(item.product.reviewCount) : "—"} />
                  <MetricRow label="Frete grátis" values={scored} format={(item) => item.selectedOffer?.freeShipping ? "✓" : "—"} />
                </div>
              </Card>

              <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
                <Card className="border-0 bg-white p-6 shadow-sm">
                  <h2 className="text-sm font-black uppercase tracking-[.15em] text-slate-400">Destaques</h2>
                  <div className="mt-5 space-y-4">
                    {[[WalletCards, "Melhor preço", intelligence.cheapest], [Flame, "Maior desconto", intelligence.biggestDiscount], [Star, "Melhor avaliação", intelligence.bestRated], [Trophy, isScoreTie ? "Empate técnico" : "Melhor escolha", { products: scoreLeaders, tied: isScoreTie }]].map(([Icon, label, item], index) => {
                      const RowIcon = Icon as typeof Trophy;
                      const leader = item as CriterionLeader;
                      return <div key={label as string} className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${index === 3 ? "bg-primary text-white" : "bg-emerald-50 text-primary"}`}><RowIcon className="h-4 w-4" /></span><span className="flex-1 text-sm font-medium text-slate-600">{label as string}</span><span className="text-sm font-black text-slate-950">{leaderLabel(leader)}</span></div>;
                    })}
                  </div>
                </Card>

                <Card className="relative overflow-hidden border-0 bg-slate-950 p-7 text-white shadow-sm">
                  <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-2xl" />
                  <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-400">Vale pagar {worthPaying.absoluteDifference != null && worthPaying.absoluteDifference > 0 ? `${money.format(worthPaying.absoluteDifference)} a mais?` : "a diferença?"}</p>
                  <div className="mt-3 text-4xl font-black">{{ YES: "Sim.", NO: "Não.", DEPENDS: "Depende." }[worthPaying.verdict]}</div>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">{worthPaying.explanation}</p>
                </Card>
              </div>

              <Card className="border-0 bg-white p-6 shadow-sm md:p-8">
                <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-primary"><Sparkles className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Análise UpPulse</p><h2 className="text-xl font-black text-slate-950">{isScoreTie ? `Empate entre ${leaderLabel({ products: scoreLeaders, tied: true })}` : `O veredito sobre ${featured.label}`}</h2></div></div>
                <div className="mt-7 grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl bg-emerald-50 p-5"><Check className="h-5 w-5 text-primary" /><h3 className="mt-3 font-bold">Pontos fortes</h3><p className="mt-1 text-sm leading-6 text-slate-600">Nota {featured.score.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}, boa reputação e oferta competitiva.</p></div>
                  <div className="rounded-xl bg-amber-50 p-5"><Tag className="h-5 w-5 text-amber-600" /><h3 className="mt-3 font-bold">Ponto de atenção</h3><p className="mt-1 text-sm leading-6 text-slate-600">Preço e condições podem mudar no marketplace. Confirme antes da compra.</p></div>
                  <div className="rounded-xl bg-slate-50 p-5"><Truck className="h-5 w-5 text-slate-700" /><h3 className="mt-3 font-bold">Nossa recomendação</h3><p className="mt-1 text-sm leading-6 text-slate-600">É a opção mais equilibrada para quem busca segurança sem abrir mão do preço.</p></div>
                </div>
                {winner?.selectedOffer?.offerUrl && <Button asChild className="mt-6 w-full gap-2 md:w-auto"><a href={winner.selectedOffer.offerUrl} target="_blank" rel="noreferrer">Ver oferta recomendada <ChevronRight className="h-4 w-4" /></a></Button>}
              </Card>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
