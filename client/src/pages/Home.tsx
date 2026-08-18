import { ArrowRight, Search, SlidersHorizontal, Sparkles, Store } from "lucide-react";
import { Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

const steps = [
  { icon: Search, title: "Descobrimos", text: "Reunimos referências de produtos para demonstrar como oportunidades de fontes autorizadas poderão ser encontradas." },
  { icon: SlidersHorizontal, title: "Organizamos", text: "Estruturamos informações para tornar pesquisa e filtros mais claros." },
  { icon: Sparkles, title: "Analisamos", text: "Preparamos critérios de comparação e inteligência para apoiar decisões com transparência." },
  { icon: Store, title: "Você escolhe", text: "A compra ou contratação acontece diretamente com o lojista responsável." },
];

const heroPaths = [
  {
    title: "EXPLORE PREÇOS E OPORTUNIDADES",
    text: "Explore produtos e oportunidades selecionadas para facilitar sua busca.",
    cta: "Explorar produtos",
    href: "/catalogo",
    testId: "button-explore-products",
  },
  {
    title: "CONHEÇA O UPPULSE",
    text: "Entenda nossa proposta, como organizamos informações e nosso modelo de parceiros.",
    cta: "Conhecer o UpPulse",
    href: "/sobre",
    testId: "button-know-uppulse",
  },
  {
    title: "DA DESCOBERTA À DECISÃO",
    text: "Veja como o UpPulse transforma informações de produtos em apoio para uma escolha mais consciente.",
    cta: "Como funciona",
    href: "/como-funciona",
    testId: "button-how-it-works",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-slate-950 px-5 py-16 text-white md:px-10 md:py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(34,197,94,.22),transparent_35%)]" />
          <div className="relative mx-auto max-w-6xl">
            <span className="inline-flex text-xs font-bold uppercase tracking-[.22em] text-emerald-300" data-testid="hero-institutional-id">
              UPPULSE <span className="mx-2 text-white/40">•</span> BY BEUPFREE
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-7xl" data-testid="home-title">
              Encontre melhores oportunidades.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
              Descubra produtos, compare informações e escolha com mais confiança.
            </p>
            <div className="mt-10 grid gap-4 lg:grid-cols-3" data-testid="hero-paths">
              {heroPaths.map((path) => (
                <article
                  key={path.href}
                  className="flex min-h-56 flex-col rounded-2xl border border-white/15 bg-white/[.06] p-6 backdrop-blur-sm transition-colors hover:border-emerald-400/60 hover:bg-white/[.09]"
                >
                  <h2 className="text-lg font-black uppercase leading-snug tracking-wide text-white">
                    {path.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{path.text}</p>
                  <Button asChild className="mt-auto w-full justify-between gap-2">
                    <Link href={path.href} data-testid={path.testId}>
                      {path.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/40 px-5 py-14 md:px-10" aria-labelledby="home-institutional-title">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[.16em] text-primary">Institucional</p>
              <h2 id="home-institutional-title" className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
                Conheça o UpPulse
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Antes de explorar, conheça nossa proposta, como a plataforma funciona e as informações desta versão demonstrativa.
              </p>
            </div>
            <nav aria-label="Informações institucionais" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Sobre o UpPulse", "/sobre"],
                ["Como funciona", "/como-funciona"],
                ["Privacidade", "/politica-de-privacidade"],
                ["Termos de Uso", "/termos-de-uso"],
                ["Contato", "/contato"],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-xl border bg-background px-4 py-4 text-sm font-bold transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </section>

        <section className="px-5 py-16 md:px-10" aria-labelledby="home-how-title">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[.16em] text-primary">Como funciona</p>
              <h2 id="home-how-title" className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
                Da descoberta à decisão, com contexto.
              </h2>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-2xl border bg-card p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
            <Button asChild variant="outline" className="mt-8">
              <Link href="/como-funciona">Entender a proposta</Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
