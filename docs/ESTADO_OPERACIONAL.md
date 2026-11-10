# UpPulse — estado operacional canônico (Missão 10.1)
Atualizado: 2026-11-10. **Este documento substitui referências operacionais antigas em .ai/PROJECT_STATE.md; nunca substitui evidências reais.**

## Regra de retomada
Antes de propor execução: ler `AGENTS.md`, este arquivo, `.ai/PROJECT_STATE.md`, `.ai/NEXT_ACTION.md`, `docs/missao10-postgres.md`, os arquivos do módulo afetado e o histórico Git da branch. Se houver divergência, conferir por consultas read-only e registrar a correção. Não adivinhar host, porta, branch, estado de migração ou homologação.

## Código e ambiente
- Repositório: `edineilemes-source/beupfree`; branch da Missão 10: `feat/uppulse-missao10-supercatalogo`. Pasta de trabalho observada: `/workspaces/uppulse-homologacao/missao9/codigo`. A nomenclatura da pasta não define a missão ativa.
- As referências antigas a `codespace-working`, `/workspaces/beupfree` e a missões de setembro são **históricas**; não tratá-las como estado operacional atual sem confirmação.
- Stack: React/TS/Vite, Express/TS, Drizzle, PostgreSQL. Domínio multi-marketplace: Produto ≠ Oferta.
- Verificar branch e commit efetivos com `git branch --show-current && git rev-parse --short HEAD && git status --short`. Não fazer reset, merge, push forçado ou deploy.
- Testes já informados pelo operador: `npm run check` e `npm run test:mission10` passaram (14 testes) antes desta consolidação. Não afirmar execução de testes novos sem evidência.

## Banco de dados — CONFIRMADO em 2026-11-10 por SQL read-only
- Contêiner Docker: `beupfree-catalog-pg17`; imagem `postgres:17-alpine`; porta do host `127.0.0.1:5435` → 5432 no contêiner.
- Banco: `uppulse_catalog`; volume persistente `beupfree-catalog-pg17-data`.
- Contagens exatas: `public.products=32707`, `public.offers=96851`, `public.catalog_search_products=16945`; tamanho observado ~1112 MB.
- `products.id` é varchar; validar conteúdo e restrições reais antes de aplicar FK/migração. `product_intelligence_cache` **foi criada com sucesso em 2026-11-10**, por migração aditiva autorizada, com 0 linhas iniciais; índices `product_intelligence_cache_pkey`, `idx_m10_cache_master`, `idx_m10_cache_expiration`. Confirmado por SQL após COMMIT.
- `beupfree-recovery-postgres` (5434) estava ativo mas seu banco `postgres` não tinha tabelas de usuário; não é a referência do catálogo. Instâncias históricas `beupfree-postgres` (5433) e bases das Missões 7/8 não são fontes de verdade.
- Se o Codespace reiniciar, o contêiner 5435 pode estar parado. Inspecionar `docker ps -a` e o volume antes de iniciar **o contêiner existente**; jamais recriar/remover volumes.
- Credenciais **não** ficam no Git. O terminal da Missão 10 não tinha `DATABASE_URL`; não copiar `.env` antigo nem usar senha da Missão 8. Para leitura no contêiner, usar `docker exec -i beupfree-catalog-pg17 sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -X -v ON_ERROR_STOP=1'`.
- Backup pré-migração: **arquivo de 109 MB confirmado e índice legível por pg_restore -l em 2026-11-10; restauração completa ainda não testada**. A PK de products.id foi confirmada e o maior ID mede 36 caracteres (nenhum acima de 36). Relatório: docs/relatorios/MISSAO10_2_PREFLIGHT_2026-11-10.md. Não rodar `db:push`, migrações ou testes mutáveis antes de verificar backup e autorização.

## Produto e catálogo
- Missão 9 consolidou código/banco e o operador relatou agrupamentos reais funcionando na interface antes do recesso. Esse funcionamento é **relato histórico**, não homologação reproduzida nesta sessão.
- Catálogo de 16945 registros da projeção inclui elegíveis Dafiti/FutFanatics; Mercado Livre DEMO não deve ser confundido com catálogo operacional.
- Preservar Product Identity Master, variantes, ofertas, filtros, organizador e UX existentes. Confirmar layout aprovado pelos arquivos e screenshots do projeto antes de alterar.

## Missão 10 — inteligência de produtos
- Implementado: `server/productIntelligence/superCatalog.ts` (identidade, SuperHash e conflitos), `research.ts` (orquestração), `liveProvider.ts` (Tavily/OpenAI), `fileCache.ts` (cache persistente local), `postgresCache.ts` (adaptador SQL), testes relacionados e migração aditiva `migrations/mission10_product_intelligence_cache.sql`.
- Smoke real já informado: Adidas Adizero Adios Pro 4, resultado ENRICHED; segunda execução reutilizou cache local, sem novas chamadas pagas. Resultados de evidências podem divergir; não fundir Master IDs automaticamente.
- `scripts/mission10-first-research.ts` usa **cache em arquivo** e identidade piloto; NÃO está integrado ao PostgreSQL. Adaptador PG testado com executor simulado, não contra banco real. A migração foi aplicada em 2026-11-10; o adaptador PostgreSQL ainda não foi homologado com escrita/leitura real.
- Credenciais de API somente em ambiente seguro. Custos, limites, concorrência e TTL ainda exigem controle antes de pesquisa em escala. Não disparar pesquisa paga automaticamente.
- Documentos: `docs/missao10-research.md` e `docs/missao10-postgres.md`.

## Infraestrutura e publicação
- Codespaces + Docker local para homologação; Hostinger/produção e gates de publicação **não autorizados** por esta missão.
- Portas e volumes são fatos ambientais sujeitos a reinicialização; reconfirmar sem vasculhar bancos históricos indiscriminadamente.
- Não publicar segredos, dumps, relatórios contendo URLs com credenciais ou dados pessoais.

## Próxima ação e critérios de encerramento
1. Preservar este estado no GitHub e manter `.ai/` sincronizado; relatório da Missão 10.1 em `docs/relatorios/`.
2. Backup de 109 MB com índice legível; restauração completa não testada. Migração aditiva já executada e validada.
3. Homologar adaptador PG com produto Master real e dados sintéticos, sem API paga; limpar somente registros de teste mediante plano seguro.
4. Concluir integração de IA com orçamento, cache, evidências e UI testados; não chamar de concluída antes disso.

## Contrato permanente de continuidade
- Cada missão deve atualizar: branch/commit, alterações, testes **realmente** executados, versão do esquema, instância/banco/porta, contagens de referência quando verificadas, infraestrutura, layout, APIs/custos, decisões, riscos e próximo passo.
- Separar **CONFIRMADO**, **RELATADO**, **IMPLEMENTADO MAS NÃO HOMOLOGADO** e **PENDENTE**. Usar data e evidência; nunca transformar intenção em fato.
- Relatório versionado no GitHub, não exigir que o usuário copie logs para o chat. Em falha de validação, registrar bloqueio e não declarar missão concluída.


## Atualização — Missão 10.5, 2026-11-10 (posterior ao estado acima)
- **HOMOLOGADO no terminal normal do Codespaces:** `node --import tsx scripts/mission10-postgres-integration.ts` retornou `MISSÃO 10.5: integração PostgreSQL aprovada e registro sintético ausente após ROLLBACK`, com `DATABASE_URL` temporária apontando para o banco existente `uppulse_catalog` em `127.0.0.1:5435`. A evidência é o resultado fornecido pelo operador; o teste foi preparado para usar IDs reais e dados sintéticos sob transação.
- **IMPLEMENTADO LOCALMENTE, NÃO VERSIONADO:** `server/productIntelligence/postgresResearch.ts`, alterações em `postgresCache.ts` e `postgresCache.test.ts`, e `scripts/mission10-postgres-integration.ts`. O piloto em arquivo permanece. O código não foi publicado; não interpretar a publicação desta documentação como deploy ou integração ativa em produção.
- **TESTES DO CODEX:** `npm run check`, `npm run test:mission10` e testes direcionados do adaptador passaram; conexão TCP falhou apenas no sandbox. A homologação PostgreSQL ocorreu posteriormente no terminal normal.
- **PENDENTE:** revisão e autorização para commit/push do código, integração ao consumidor de aplicação/UI, controle de custos/concorrência e gates gerais. Não foram reconferidas contagens comerciais nesta etapa.
- Relatório: [Missão 10.5](relatorios/MISSAO10_5_INTEGRACAO.md). As afirmações anteriores de que o adaptador PostgreSQL não foi homologado representam o estado *anterior* a esta atualização.
