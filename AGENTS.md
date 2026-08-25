# AGENTS.md — BeUpFree / UpPulse

## Objetivo do agente

Trabalhe com autonomia para analisar, implementar, testar e revisar melhorias no BeUpFree/UpPulse. Evite perguntas desnecessárias. Para decisões técnicas reversíveis e compatíveis com estas regras, escolha a alternativa mais segura e prossiga.

Pergunte ao usuário somente quando houver:

- decisão de negócio que altere o produto de forma relevante;
- risco de perda ou migração destrutiva de dados;
- necessidade de credencial, segredo ou autorização externa;
- ação irreversível;
- publicação em produção;
- conflito real entre requisitos que não possa ser resolvido pelo código ou pela documentação.

## Regra estrutural obrigatória: multi-marketplace

Todas as funcionalidades devem ser concebidas como multi-marketplace desde a origem.

- Mercado Livre é apenas o primeiro parceiro.
- Arquitetura, domínio, banco, APIs, Favoritos, Minha Lista, comparação, histórico, alertas, links afiliados e interface não podem depender exclusivamente do Mercado Livre.
- Não use nomes genéricos acoplados a `ml`, `meli` ou `mercado_livre`.
- Integrações específicas devem ficar atrás de adaptadores, serviços ou módulos de marketplace.
- Preserve a distinção: Produto não é Oferta.
- Um produto pode ter ofertas de vários marketplaces.
- Regras específicas de um parceiro não devem contaminar o modelo de domínio.

Código legado específico do Mercado Livre pode continuar existindo, mas novas funcionalidades e refatorações devem reduzir o acoplamento progressivamente.

## Base de trabalho e Git

- A branch de integração e homologação é `codespace-working`.
- Crie uma branch específica para cada tarefa a partir de `codespace-working`.
- Não altere, force-push, resete ou faça merge na `main` sem autorização explícita.
- Não faça merge automaticamente.
- Ao concluir uma tarefa, prepare commit e pull request para `codespace-working`.
- Preserve alterações existentes que não pertençam à tarefa.
- Antes de editar, verifique o estado do repositório e os arquivos relevantes.
- Nunca inclua `.env`, credenciais, tokens ou segredos no Git.

## Ambiente

Stack principal:

- React 18 + TypeScript + Vite;
- Wouter;
- TanStack React Query;
- Tailwind CSS + shadcn/ui/Radix;
- Node.js + Express + TypeScript;
- PostgreSQL + Drizzle ORM;
- Playwright.

No GitHub Codespaces, o ritual oficial é:

```bash
cd /workspaces/beupfree
./start-codespace.sh
```

O script controla a porta 5000. Não encerre processos existentes para liberar essa porta. Se o UpPulse já estiver respondendo com HTTP 200, reutilize a instância existente.

No Codex Cloud, não execute `start-codespace.sh` como configuração persistente. Instale dependências no setup e inicie o servidor somente quando a tarefa ou um teste precisar dele.

## Fluxo autônomo de execução

Para cada solicitação:

1. Entenda o comportamento atual pelo código, testes e documentação.
2. Defina internamente um plano curto.
3. Implemente a menor mudança completa que resolva a solicitação.
4. Atualize ou crie testes relevantes.
5. Execute verificações proporcionais ao risco.
6. Corrija falhas causadas pela mudança.
7. Revise o diff em busca de regressões, acoplamento e segredos.
8. Entregue um resumo objetivo com arquivos alterados, testes executados e limitações reais.

Não pare apenas em análise quando a solicitação pedir implementação. Não peça confirmação entre essas etapas.

## Verificação

Comandos disponíveis:

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run test:regression
npm run test:public-demo
npm run build
```

Use verificações proporcionais:

- alteração pequena de lógica: `npm run check` e testes unitários relacionados;
- frontend ou fluxo do usuário: acrescente Playwright relevante;
- mudança transversal ou preparação de PR: execute `npm run check`, `npm run test:unit` e `npm run build`;
- execute a regressão completa quando a mudança afetar navegação, catálogo, favoritos, comparação, autenticação ou integrações centrais.

Se um teste não puder rodar por falta de banco, segredo, rede ou serviço externo, registre exatamente o impedimento. Não invente resultados.

## Banco de dados e integrações

- Trate `DATABASE_URL` e outras credenciais como segredo.
- Não execute migração destrutiva nem `db:push` em banco compartilhado sem autorização explícita.
- Prefira migrações aditivas e compatíveis.
- Coletores e integrações externas devem tolerar indisponibilidade, limites, respostas incompletas e mudanças de formato.
- Não faça chamadas reais que publiquem, comprem, enviem mensagens ou modifiquem serviços externos sem autorização.
- Preserve o pipeline Coletar → Processar → Triar → Publicar.

## Interface

- Preserve o design responsivo e mobile-first.
- Siga os componentes e tokens existentes antes de criar novos padrões.
- Estados de carregamento, vazio, erro e sucesso fazem parte da entrega.
- Evite textos ou controles que suponham um único marketplace quando o conceito for geral.
- Não remova funcionalidades ou testes para fazer uma nova alteração passar.

## Segurança operacional

Sem autorização explícita, não:

- publicar na Hostinger;
- alterar DNS ou domínio;
- fazer merge;
- alterar a `main`;
- remover dados;
- executar comandos destrutivos;
- expor segredos;
- desativar testes, autenticação ou validações de segurança.

## Critério de conclusão

Uma tarefa está concluída quando:

- o comportamento solicitado foi implementado;
- a arquitetura multi-marketplace foi preservada;
- os testes relevantes foram atualizados e executados;
- o código foi revisado;
- limitações e verificações não executadas foram declaradas;
- a alteração está pronta para revisão em branch ou pull request separado.
