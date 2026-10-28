# Operação isolada da Missão 8

Código nesta cópia; banco `uppulse_missao8` em 127.0.0.1:5437.
Nenhum comando abaixo importa feeds ou escreve dados comerciais.

- `npm run identity:catalog:homologation`: varre todas as identidades reconciliadas, compara todos os tiles de marca, inclusive entre lotes, e publica atomicamente o sidecar. Repita após reconciliações para processar inputs novos/alterados. Não usa limite silencioso de 2.000 identidades.
- `python3 scripts/missao8-preview.py --built`: inicia somente em 5019 livre e exige URL do banco isolado.
- `npm run test:master-catalog`: testes unitários de orquestração e facetas.
- `MASTER_DATABASE_URL=<URL privada de uppulse_missao8_test em 5437> npm run test:master-integration`: fixtures exclusivamente no segundo banco descartável; nunca executar fixtures no catálogo medido.

## Motor e cobertura

Parser, matcher, candidatura, grouping e fixtures históricos não são editados. Cada tile contém até 2.000 entradas (duas unidades de até 1.000) e executa `runShadow` original com configuração padrão. Todas as combinações de unidades dentro da mesma marca são agendadas; sem marca não há candidatura histórica. Nenhum bloco é eliminado por limite de coorte. Top-K, retrieval e avaliação continuam limitados **por tile**. A seleção é local ao tile, não se afirma resultado idêntico a um `runShadow` global inexistente de 32.199 entradas.

As decisões são deduplicadas, divergência determinística aborta; o `simulateGroups` histórico confere toda fronteira de união. Verificações adicionais usam o matcher original, com budget próprio de até 20.000 pares; insuficiência bloqueia união. REVIEW/SINGLETON não são equivalência. Os grupos finais passam novamente pela verificação de todos os pares antes da transação ser confirmada.

Os contadores de truncamento/retrieval são ocorrências somadas dos tiles; pares e candidatos selecionados são únicos. Não são uma estimativa de recall. As listas completas de candidatos truncados não são persistidas no run global; os contadores são explícitos. Nenhuma alegação de SKU global ou nome comercial editorial.

## Retry, cursor e entrega

Checkpoint privado por hash de versões/configuração/snapshot completo do tile em `/tmp/uppulse-missao8-checkpoints`, escrito por rename atômico. Os arquivos são descartáveis: sua perda exige recomputação, sem perda de decisões confirmadas. A cada retomada, o manifesto determinístico é percorrido; tiles já confirmados são lidos do checkpoint e a avaliação retoma nos faltantes. O cursor no job é auditável, não um atalho que ignora inputs alterados. Mudança de qualquer snapshot invalida os tiles afetados. A composição final é sempre recalculada e sua persistência é atômica.

Lock de worker impede duas varreduras simultâneas; o writer mantém serialização, repeatable-read, idempotência, auditoria imutável e fechamento temporal da Missão 7. Falha anterior ao COMMIT não deixa vínculos parciais.

A notificação pós-COMMIT continua best effort. A varredura do estado reconciliado funciona como recuperação durável de lacunas: mesmo sem evento na fila, dados novos/alterados são vistos na próxima execução. Não é outbox transacional e não garante entrega de cada evento intermediário nem histórico de revisões comerciais já sobrescritas. Um serviço com agendamento/restart supervisionado e outbox para eventos individuais ainda requer integração operacional; nenhum daemon ou feed é iniciado por este comando.

A conexão do worker usa `enable_mergejoin=off` e `work_mem=128MB` para evitar o plano custoso observado no snapshot. Isso altera somente o plano físico da consulta SQL histórica, preservada literalmente; não altera candidatura ou matching. A sonda somente leitura retornou 32.199 linhas em cerca de 23 segundos com esse plano.

## Navegador de testes

A suíte Master usa o navegador privado em `/tmp/uppulse-missao8-browsers` (sobrescrevível por `PLAYWRIGHT_BROWSERS_PATH`). Para reconstruir: `PLAYWRIGHT_BROWSERS_PATH=/tmp/uppulse-missao8-browsers node_modules/.bin/playwright install chromium`. Para regressão: `PLAYWRIGHT_BROWSERS_PATH=/tmp/uppulse-missao8-browsers PLAYWRIGHT_BASE_URL=http://127.0.0.1:5019 npm run test:regression`. Os testes de agrupamento/rolagem estão incluídos em `npm run test:master-ui`.
