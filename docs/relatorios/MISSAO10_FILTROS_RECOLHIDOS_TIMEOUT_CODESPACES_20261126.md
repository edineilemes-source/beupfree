# UpPulse — vitrine com filtros recolhidos e Codespaces com maior tempo de inatividade

**Data:** 26/11/2026.
**Repositório:** `edineilemes-source/beupfree`.
**Branch canônica:** `feat/uppulse-missao10-supercatalogo`.
**Código homologável:** `b24bb62ca5af3206236fc89f67fe9ce7281f2f70`.

## Solicitação
1. Os filtros da vitrine inicial (especialmente Cor e Tamanho) deveriam iniciar **todos fechados** e abrir sob demanda para não alongar a página.
2. Usuário pediu aumentar a duração do Codespaces para que a porta 5013 não caia durante os testes.

## Implementação do site
- `client/src/components/CatalogFilterSidebarV2.tsx`: `Section` inicia em `open=false` e implementa botão `aria-expanded`/`aria-controls` com ID acessível. Cada painel recebe `hidden` quando recolhido, em vez de desmontar os campos; assim preserva conteúdo e seleções existentes na URL. Funciona para todos os grupos existentes na versão ativa do catálogo.
- `client/src/components/CatalogFilterSidebarV2.test.ts`: valida todos os grupos recolhidos, inclusive Cor, Tamanho, Preço, Desconto e Frete, e preservação de chips/valores.
- `tests/e2e/catalog.spec.ts`: abre Cor antes de selecionar, compatível com o novo estado inicial.
- `tests/e2e/filters-v3/colors.spec.ts`: interação em desktop/mobile: começa fechado, abre Cor/Tamanho separadamente, mantém seleção após recolhimento e atualização da página.
- `package.json`: inclui regressão de filtros V2 na suíte normal.
- `.github/workflows/uppulse-filtros-fechados.yml`: TypeScript, unidade, build e Playwright responsivo.
- **GitHub Actions #45907013539 = SUCCESS** no SHA acima, cobrindo compilação, testes unitários e interação real simulada em navegador para desktop e mobile.
- Atualização oficial da branch efetuada por avanço não destrutivo (fast-forward). Nenhum `reset`, `checkout`, migração ou alteração de PostgreSQL.

## Codespaces / custo
- Documentação GitHub vigente: configuração padrão `Default idle timeout` em https://github.com/settings/codespaces, entre 5 e 240 minutos (quatro horas); padrão 30 minutos e máximo absoluto de 12 horas de vida contínua.
- Recomendação: **120 minutos** como compromisso durante os testes. Configuração pessoal afeta a criação de **novos Codespaces**. O GitHub não expõe ajuste de `idle_timeout_minutes` para um Codespace existente nos parâmetros documentados de `PATCH /user/codespaces/{name}` e `gh codespace edit`.
- A alteração do limite da conta **não foi executada**, por falta de ação autenticada autorizada para preferências pessoais; não substituir nem recriar `uppulse-homologacao` porque armazena a base do projeto. Mudança efetiva no codespace atual ainda não comprovada.
- O uso do Codespaces consome franquia/horas faturáveis enquanto ligado. **Não introduzir keepalive** para contornar o gerenciamento ou produzir cobranças não pretendidas.
- URL da documentação: https://docs.github.com/pt/codespaces/setting-your-user-preferences/setting-your-timeout-period-for-github-codespaces

## Preview 5013
- GitHub Issue #121: tentativa controlada de parada de preview anterior, reportou ausência de processo gerenciado; outros processos preservados.
- GitHub Issue [#122](https://github.com/edineilemes-source/beupfree/issues/122): **SUCCESS Preview OK HTTP 200; profile basic passed** do snapshot `b24bb62ca5af3206236fc89f67fe9ce7281f2f70` na porta 5013. HTTP local verificado pelo agente, mas encaminhamento público ainda requer teste no navegador.
- O GitHub port forwarding público continua sujeito a problema separado de acesso externo (404 antigo); HTTP local 200 não é prova suficiente de acesso pelo navegador.
- Homologar visualmente: vitrine inicia com todas as seções fechadas, cor/tamanho abrem ao clique, chips de seleção/ordenação não mudam.

## Impacto
- **Banco e feeds:** nenhum. **Produção/Hostinger:** inalterada.
- **Limite do Codespaces existente:** não alterado.
- **Próxima ação:** confirmar Issue #122; validar navegador; usuário ajusta o padrão em GitHub Settings se concordar com custo. Não recriar ambiente.
