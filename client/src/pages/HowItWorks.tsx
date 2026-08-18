import PublicPageLayout from "@/components/PublicPageLayout";

const steps = [
  ["1. Descobrimos", "Reunimos produtos e oportunidades provenientes de fontes e parceiros autorizados. Nesta versão, o catálogo é um snapshot demonstrativo."],
  ["2. Organizamos", "Organizamos as informações para facilitar busca, filtros, identificação de produtos e futura comparação entre ofertas equivalentes."],
  ["3. Analisamos", "Nossa visão é evoluir a comparação e a análise para apoiar escolhas mais conscientes, conforme houver informações autorizadas e de qualidade suficiente."],
  ["4. Você escolhe", "O UpPulse não realiza a venda. A compra ou contratação ocorre diretamente com o lojista responsável."],
];

export default function HowItWorks() {
  return (
    <PublicPageLayout title="Como funciona" eyebrow="UpPulse">
      <p>O UpPulse organiza oportunidades comerciais em uma jornada de descoberta mais simples e compreensível, que começa pela necessidade do consumidor.</p>
      <div className="not-prose mt-8 grid gap-4 sm:grid-cols-2">
        {steps.map(([title, text]) => (
          <section key={title} className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
          </section>
        ))}
      </div>
      <h2>Demonstração atual</h2>
      <p>Os produtos, valores, descontos e condições exibidos nesta versão servem apenas para demonstrar busca, filtros e favoritos. Eles podem não refletir as condições atuais da loja.</p>
      <h2>Modelo de parceiros</h2>
      <p>O UpPulse está sendo preparado para reunir catálogos e ofertas fornecidos por lojas, marcas e redes de afiliados a partir de fontes autorizadas. A compra é realizada diretamente no ambiente do lojista responsável.</p>
    </PublicPageLayout>
  );
}
