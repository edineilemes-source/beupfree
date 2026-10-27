# Auditoria UX V2 — Playwright (sem Codex)

Esta suíte é independente e não altera o Playwright existente. Faz capturas e diagnósticos de leitura das rotas /, /catalogo e /catalogo-v2 em quatro tamanhos de tela.

## Preparar worktree (uma única vez)
A partir do Codespaces existente, sem mudar a branch atual:

```bash
cd /workspaces/beupfree
git fetch origin feat/uppulse-layout-ux
git worktree add /workspaces/beupfree-layout -b local/uppulse-layout-ux origin/feat/uppulse-layout-ux
cd /workspaces/beupfree-layout
npm ci
```

Se o worktree já existir, não recrie. Inspecione com `git worktree list` e atualize apenas a branch da frente UX.

## Servidor na porta 5001

```bash
cd /workspaces/beupfree-layout
PORT=5001 npm run dev
```

Abra a porta 5001 na aba **Ports** do Codespaces. Não encerre o servidor da porta 5000. A porta 5001 pode precisar das mesmas variáveis de ambiente e serviços de leitura utilizados pela aplicação original.

## Rodar auditoria

Em outro terminal do Codespaces:

```bash
cd /workspaces/beupfree-layout
npx playwright test --config=playwright.ux.config.ts
```

Se o Chromium ainda não estiver instalado: `npx playwright install chromium`.

Os screenshots e o relatório HTML ficam em `playwright-report/ux-audit` e os diagnósticos JSON em `test-results/ux-audit/diagnostics`. Esses resultados são locais e não devem ser versionados automaticamente.

Para consultar o relatório no Codespaces, use:

```bash
npx playwright show-report playwright-report/ux-audit --host 0.0.0.0 --port 5002
```

Abra a porta 5002 na aba Ports. Não use esta suíte contra produção ou ambientes com dados sensíveis sem revisão.

## Limitações

É uma auditoria inicial de renderização, responsividade e console; não substitui testes funcionais profundos do Organizador V2, acessibilidade completa ou medição de desempenho. Os resultados dependem do banco e dos serviços disponíveis no Codespaces.
