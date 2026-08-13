# Regressão automática V1

Esta suíte transforma os principais fluxos do UpPulse V1 em cenários Playwright executáveis e independentes. Ela cobre a experiência real no navegador e usa o PostgreSQL como fonte de verdade para contas e Favoritos autenticados.

> Bug encontrado uma vez deve ganhar teste de regressão.

## Comandos

```bash
npm run test:regression
npm run test:regression:headed
npm run test:regression:report
```

`npm run test:e2e` continua executando toda a suíte E2E, inclusive `tests/e2e/regression`. O comando específico usa `playwright.regression.config.ts` e executa apenas a regressão V1.

## Pré-requisitos e health check

- `DATABASE_URL` definida com protocolo `postgres:` ou `postgresql:`;
- PostgreSQL acessível;
- migrations aplicadas, incluindo as tabelas `users`, `user_favorites` e `session`;
- aplicação inicializável em `http://127.0.0.1:5000` (ou `PLAYWRIGHT_BASE_URL`);
- catálogo com pelo menos três produtos para os cenários que comparam itens dinâmicos.

Antes dos testes, o global setup valida banco, migrations, aplicação, `/api/products` e `/api/auth/me`. Falhas de ambiente abortam imediatamente e informam a causa. O catálogo nunca é truncado ou modificado pelo cleanup.

## Cobertura

Os arquivos em `tests/e2e/regression` cobrem smoke global, catálogo, busca, filtros, cadastro, login, sessão/logout, Favoritos anônimos e autenticados, importação SIM/NÃO, isolamento entre contas, novo dispositivo e computador compartilhado. As personas são anônimo, recém-cadastrado, autenticado com Favoritos, segundo usuário e browser context limpo.

Os dados são selecionados dinamicamente do catálogo. E-mails únicos começam com `regression-v1-`; o teardown remove somente sessões e usuários com esse prefixo. Favoritos associados são removidos pelo `ON DELETE CASCADE`.

## Diagnóstico e artefatos

Cada página principal é observada para `pageerror`, `console.error` e respostas HTTP 500/502/503/504. A lista de exceções conhecidas é explícita e restrita no helper; atualmente inclui apenas o texto genérico que o Chromium emite para os 401 esperados de sessão anônima/login inválido e um favicon 404. Erros críticos são anexados como `critical-errors.txt`.

Em falha, consulte:

- `test-results/regression/`: screenshot, vídeo, trace e anexos do cenário;
- `playwright-report/regression/`: relatório HTML;
- saída `list`: total, cenários aprovados/falhos e localização da asserção.

Screenshots são gerados somente em falha, vídeos são retidos somente em falha e traces são capturados na primeira repetição. Execuções aprovadas não mantêm artefatos pesados.

## Adicionando uma regressão

1. Reproduza o bug em uma spec do domínio adequado, usando role/nome acessível ou `data-testid`.
2. Se a interação for reutilizável, adicione-a em `support/actions.ts`.
3. Se houver um erro conhecido legítimo, inclua um padrão específico em `support/fixture.ts`; nunca ignore todos os erros.
4. Use `expect` e esperas determinísticas. Não use `waitForTimeout`, ordem fixa, marca, preço ou produto estático.
5. Use `persona()` para contas e assegure que qualquer dado adicional permaneça dentro do prefixo de cleanup.
6. Rode `npm run test:regression` e confirme os artefatos provocando uma falha local controlada, sem manter essa falha no código.
