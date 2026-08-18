import PublicPageLayout from "@/components/PublicPageLayout";

export default function PrivacyPolicy() {
  return (
    <PublicPageLayout title="Política de Privacidade" eyebrow="Última atualização: 18 de agosto de 2026">
      <p>Esta política descreve o tratamento de dados realizado na versão atual do UpPulse. Ela deverá ser atualizada antes da ativação de novas integrações, analytics ou parceiros.</p>
      <h2>Dados tratados</h2>
      <ul>
        <li>nome e e-mail informados no cadastro;</li>
        <li>credenciais protegidas por hash para autenticação;</li>
        <li>sessão necessária para manter o acesso à conta;</li>
        <li>produtos adicionados aos Favoritos;</li>
        <li>dados técnicos básicos necessários à segurança e operação do servidor, como registros de requisição.</li>
      </ul>
      <p>Favoritos de visitantes sem conta ficam armazenados no próprio navegador. Para usuários autenticados, os Favoritos são mantidos na conta e podem utilizar cache local por usuário.</p>
      <h2>Finalidades</h2>
      <p>Usamos esses dados para criar e autenticar contas, sincronizar Favoritos, manter a segurança, diagnosticar falhas e operar a aplicação.</p>
      <h2>Cookies e sessão</h2>
      <p>A aplicação utiliza cookie de sessão estritamente necessário para autenticação. A versão atual não declara cookies publicitários ou ferramentas externas de analytics.</p>
      <h2>Retenção e segurança</h2>
      <p>Os dados são mantidos enquanto necessários para prestar o serviço, cumprir obrigações aplicáveis e proteger a plataforma. Empregamos controles técnicos compatíveis com o estágio do produto, mas nenhum sistema é totalmente isento de risco.</p>
      <h2>Direitos previstos na LGPD</h2>
      <p>O titular pode solicitar confirmação de tratamento, acesso, correção, informação, portabilidade quando aplicável, revogação de consentimento e eliminação nos limites legais. Solicitações podem ser feitas pelo canal indicado na página de Contato.</p>
      <h2>Atualizações</h2>
      <p>Esta política será revisada quando feeds autorizados, links de afiliados, novos fornecedores ou outros tratamentos forem ativados.</p>
    </PublicPageLayout>
  );
}
