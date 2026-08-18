import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";
import PublicPageLayout from "@/components/PublicPageLayout";
import { Button } from "@/components/ui/button";

const filters = ["Tênis", "Corrida", "Masculino", "Tamanho 40", "Até R$ 500", "Em promoção"];
const journey = ["Descobrir", "Organizar", "Filtrar", "Comparar", "Compreender", "Decidir"];
const questions = [
  "Quais produtos realmente atendem ao que estou procurando?",
  "Quais características diferenciam uma opção da outra?",
  "O desconto apresentado representa uma oportunidade interessante?",
  "Existem alternativas semelhantes?",
  "Vale a pena pagar mais por determinado produto?",
  "Qual opção apresenta melhor relação entre minhas necessidades e aquilo que está sendo oferecido?",
];

function Highlight({ children }: { children: ReactNode }) {
  return (
    <blockquote className="not-prose my-8 rounded-2xl border-l-4 border-primary bg-emerald-50 px-6 py-5 text-lg font-bold leading-8 text-slate-900 sm:text-xl">
      {children}
    </blockquote>
  );
}

export default function About() {
  return (
    <PublicPageLayout title="Sobre o BeUpFree e o UpPulse" eyebrow="Quem somos">
      <section aria-labelledby="nova-forma">
        <h2 id="nova-forma">Uma nova forma de encontrar boas oportunidades</h2>
        <p>A internet oferece uma quantidade enorme de produtos, lojas, marketplaces e promoções. Essa variedade trouxe mais opções para o consumidor, mas também criou um novo problema: encontrar, entre milhares de ofertas espalhadas por diferentes sites, aquilo que realmente interessa.</p>
        <p>Pesquisar produto por produto, visitar diferentes lojas, comparar preços, características, descontos e condições pode exigir tempo e tornar uma decisão aparentemente simples cada vez mais trabalhosa.</p>
        <p>O BeUpFree nasce a partir dessa realidade.</p>
        <p>Nossa proposta é construir uma <strong>plataforma agregadora de oportunidades</strong>, capaz de reunir produtos em promoção provenientes de diferentes lojas e parceiros, organizar essas informações por categorias e tornar sua descoberta mais simples, clara e útil para o consumidor.</p>
        <p>Em vez de o usuário precisar procurar a oportunidade em vários lugares, queremos aproximar as oportunidades do usuário.</p>
      </section>

      <section aria-labelledby="um-so-lugar">
        <h2 id="um-so-lugar">BeUpFree: diferentes oportunidades, um só lugar</h2>
        <p>A visão do BeUpFree é evoluir para um ambiente no qual produtos em promoção de diferentes lojas possam ser encontrados de forma organizada e categorizada.</p>
        <p>A plataforma está sendo concebida para não depender de uma única loja, marca ou marketplace. À medida que novas integrações e parceiros forem incorporados, diferentes fontes autorizadas poderão contribuir para ampliar a variedade de produtos e oportunidades disponíveis.</p>
        <p>O objetivo é permitir que o consumidor parta daquilo que procura — e não necessariamente da loja em que pretende procurar.</p>
        <div className="not-prose my-8 rounded-2xl border bg-slate-950 p-5 text-white sm:p-7" data-testid="about-filter-example">
          <p className="mb-4 text-xs font-bold uppercase tracking-[.18em] text-emerald-300">Um exemplo de busca</p>
          <div className="flex flex-wrap items-center gap-2" aria-label={filters.join("; ")}>
            {filters.map((filter, index) => (
              <div key={filter} className="contents">
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold">{filter}</span>
                {index < filters.length - 1 && <ArrowRight className="h-4 w-4 flex-none text-emerald-300" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>
        <p>A partir desses critérios, o objetivo do BeUpFree é tornar possível encontrar e organizar oportunidades provenientes de diferentes lojas, facilitando a descoberta das alternativas que realmente atendem à necessidade daquele consumidor.</p>
        <Highlight>Primeiro vem a necessidade do usuário; depois, as lojas e oportunidades capazes de atendê-la.</Highlight>
      </section>

      <section aria-labelledby="primeiro-projeto">
        <h2 id="primeiro-projeto">UpPulse: o primeiro projeto BeUpFree</h2>
        <p>O UpPulse é a primeira aplicação dessa visão.</p>
        <p>Escolhemos começar por tênis em promoção, uma categoria que combina grande variedade de marcas, modelos, características, finalidades de uso, tamanhos e faixas de preço.</p>
        <p>Um tênis pode ser destinado à corrida, caminhada, academia, uso casual ou outras atividades. Pode variar por gênero, idade, tamanho, cor, marca, características e preço. Além disso, um mesmo tipo de produto pode aparecer em diferentes lojas e sob diferentes condições comerciais.</p>
        <p>Por isso, tênis representam um excelente primeiro ambiente para desenvolver e aperfeiçoar a experiência que imaginamos para o BeUpFree.</p>
        <p>Nesta primeira etapa, o UpPulse permite explorar produtos utilizando diferentes critérios de pesquisa e filtros, procurando reduzir a quantidade de opções irrelevantes e aproximar o usuário daquilo que realmente procura.</p>
      </section>

      <section aria-labelledby="mais-que-promocoes">
        <h2 id="mais-que-promocoes">Mais do que uma lista de promoções</h2>
        <p>O objetivo do UpPulse não é simplesmente apresentar uma grande quantidade de produtos.</p>
        <p>Uma lista com centenas ou milhares de resultados pode continuar deixando o consumidor com o mesmo problema: <strong>qual escolher?</strong></p>
        <p>Nossa visão é evoluir progressivamente da descoberta para o apoio à decisão.</p>
        <ol className="not-prose my-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="about-journey">
          {journey.map((step, index) => (
            <li key={step} className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">{index + 1}</span>
              <span className="font-bold uppercase tracking-wide">{step}</span>
            </li>
          ))}
        </ol>
        <p>Hoje, o foco está principalmente nas primeiras etapas. À medida que novas fontes autorizadas e informações de maior qualidade forem incorporadas, o UpPulse poderá evoluir seus recursos de comparação e análise.</p>
        <div className="not-prose my-8 rounded-2xl border bg-muted/50 p-5 sm:p-7">
          <h3 className="text-lg font-black">Perguntas que orientam essa visão</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {questions.map((question) => <li key={question} className="rounded-xl bg-background p-4 text-sm leading-6 shadow-sm">{question}</li>)}
          </ul>
        </div>
      </section>

      <section aria-labelledby="descoberta-decisao">
        <h2 id="descoberta-decisao">Da descoberta à decisão</h2>
        <p>O volume de informação disponível na internet não significa necessariamente que o consumidor esteja mais bem informado.</p>
        <p>Muitas vezes, quanto maior o número de alternativas, maior pode ser a dificuldade de comparar e decidir.</p>
        <p>O UpPulse pretende organizar essas informações para que a tecnologia trabalhe a favor do consumidor. Em vez de simplesmente mostrar mais resultados, nossa intenção é ajudar a tornar os resultados mais relevantes, compreensíveis e úteis.</p>
        <Highlight>Menos tempo procurando. Mais informação para decidir.</Highlight>
      </section>

      <section aria-labelledby="independente">
        <h2 id="independente">Uma plataforma independente</h2>
        <p>O UpPulse não é uma loja e não realiza diretamente a venda dos produtos apresentados.</p>
        <p>A plataforma foi concebida para trabalhar com diferentes lojas, marcas, redes de afiliados e outros parceiros, sem depender exclusivamente de um único marketplace.</p>
        <p>Quando houver uma oferta disponibilizada por um parceiro integrado à plataforma, a compra será realizada diretamente no ambiente do lojista responsável, sujeita às condições comerciais, pagamento, disponibilidade, entrega, troca e devolução daquele lojista.</p>
        <p>Essa independência permite que a busca comece pelo interesse do consumidor, e não pela obrigação de pesquisar dentro de uma única loja.</p>
      </section>

      <section aria-labelledby="futuro">
        <h2 id="futuro">O futuro do BeUpFree</h2>
        <p>O UpPulse começa com tênis em promoção, mas a visão do BeUpFree é mais ampla.</p>
        <p>A experiência desenvolvida neste primeiro projeto pretende servir como base para a criação futura de outras categorias de produtos e oportunidades.</p>
        <p>Gradualmente, o BeUpFree poderá incorporar novos segmentos, novas lojas, novos parceiros e novas formas de organizar oportunidades. A expansão deve acontecer progressivamente e depender de informações adequadas e fontes autorizadas.</p>
        <Highlight>O UpPulse não é apenas um catálogo de tênis: é o primeiro passo de uma proposta maior de organização e inteligência sobre oportunidades comerciais.</Highlight>
      </section>

      <section aria-labelledby="integracoes">
        <h2 id="integracoes">Integrações e parceiros</h2>
        <p>O UpPulse está em fase de implantação de suas primeiras integrações comerciais e de afiliados.</p>
        <p>A plataforma foi preparada para receber informações provenientes de diferentes parceiros e fontes autorizadas, permitindo que novas lojas e oportunidades sejam incorporadas progressivamente.</p>
        <p>Essa abordagem busca ampliar a diversidade de opções disponíveis ao consumidor sem criar dependência de uma única fonte. Empresas, marcas ou redes de afiliados somente serão apresentadas como parceiras quando essas relações estiverem formalmente estabelecidas.</p>
      </section>

      <section aria-labelledby="afiliados">
        <h2 id="afiliados">Transparência e modelo de afiliados</h2>
        <p>O BeUpFree pretende utilizar, entre seus modelos de sustentabilidade, programas de afiliados.</p>
        <p>Quando uma integração desse tipo estiver ativa, alguns links apresentados pelo UpPulse poderão ser links de afiliados. Nesses casos, se o consumidor acessar uma loja por meio do UpPulse e realizar uma compra elegível, o BeUpFree poderá receber uma comissão.</p>
        <Highlight>Isso não representa custo adicional para o consumidor.</Highlight>
        <p>A existência de comissão não deve determinar sozinha quais produtos são apresentados como melhores alternativas. A utilidade da informação para o usuário deve permanecer como princípio da experiência.</p>
      </section>

      <section aria-labelledby="demonstracao" className="not-prose my-10 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 sm:p-8">
        <h2 id="demonstracao" className="text-2xl font-black">Sobre esta versão demonstrativa</h2>
        <p className="mt-4 leading-7">O UpPulse encontra-se em desenvolvimento.</p>
        <p className="mt-3 leading-7">Os produtos apresentados nesta versão pública são utilizados para demonstrar a experiência de navegação, pesquisa, categorização e filtragem da plataforma.</p>
        <p className="mt-3 leading-7">Preços, descontos, disponibilidade e demais condições comerciais exibidos nesta demonstração podem não corresponder às condições atualmente praticadas pelas lojas.</p>
        <p className="mt-3 leading-7">À medida que integrações autorizadas forem incorporadas, esses dados poderão ser substituídos por informações fornecidas pelos respectivos parceiros.</p>
      </section>

      <section aria-labelledby="nossa-visao" className="not-prose -mx-6 mb-[-1.5rem] mt-12 rounded-b-2xl bg-slate-950 px-6 py-10 text-white sm:-mx-10 sm:mb-[-2.5rem] sm:px-10 sm:py-12">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">Nossa visão</p>
        <h2 id="nossa-visao" className="mt-3 text-3xl font-black">O BeUpFree parte de uma ideia simples:</h2>
        <p className="mt-6 text-xl font-bold leading-8 text-white sm:text-2xl">“As pessoas não deveriam precisar visitar dezenas de lugares para descobrir uma boa oportunidade.”</p>
        <p className="mt-6 leading-7 text-slate-300">Queremos construir uma plataforma em que diferentes oportunidades possam ser reunidas, organizadas e compreendidas de maneira mais simples.</p>
        <p className="mt-4 leading-7 text-slate-300">O UpPulse é nosso primeiro passo. Começamos com tênis em promoção.</p>
        <p className="mt-4 leading-7 text-slate-300">Mas o que estamos construindo é uma experiência para ajudar pessoas a transformar uma enorme quantidade de opções em oportunidades que façam sentido para elas.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild><Link href="/como-funciona">Entenda a jornada <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button>
          <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link href="/catalogo">Explorar produtos</Link></Button>
        </div>
      </section>
    </PublicPageLayout>
  );
}
