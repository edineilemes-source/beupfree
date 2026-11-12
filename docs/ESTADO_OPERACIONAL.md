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


## Atualização posterior — Missão 10.5 publicada, 2026-11-10

**PUBLICADO:** o código da Missão 10.5 foi revisado pelo Codex, considerado apto para publicação e enviado à branch `feat/uppulse-missao10-supercatalogo` no commit `8afe2dd`. Foram versionados exatamente quatro arquivos: `server/productIntelligence/postgresCache.ts`, `server/productIntelligence/postgresCache.test.ts`, `server/productIntelligence/postgresResearch.ts` e `scripts/mission10-postgres-integration.ts`. O resultado de push foi confirmado pelo operador. A homologação PostgreSQL transacional foi aprovada **antes** dos últimos ajustes de segurança do script; estes passaram nos testes de código, mas não foram reexecutados no banco real após os ajustes. As frases anteriores 'não versionado' são histórico superado. Não houve deploy nem ativação de pesquisas pagas. **Próxima missão: 10.6**, concorrência e limites de custos. Seguir o contrato de publicação documental em `AGENTS.md`.

## Atualização — Missão 10.6, 2026-11-10

- **IMPLEMENTADO E TESTADO LOCALMENTE:** deduplicação por SuperHash no processo, reserva compartilhada de execução para o serviço PostgreSQL e reserva de orçamento estimado antes de cada chamada Tavily/OpenAI. O checkout de código está em `8afe2dd`. A base documental remota consultada é `d698d23`.
- **PENDENTE DE HOMOLOGAÇÃO:** coordenação e orçamento em PostgreSQL real dependem da proposta aditiva local `migrations/mission10_research_coordination.sql`. A migração não foi aplicada. Manter `RESEARCH_PAID_ENABLED` e `RESEARCH_POSTGRES_HOMOLOGATED` desabilitados. Nenhum acesso a banco, alteração comercial ou chamada paga nesta execução.
- **Verificações:** TypeScript e testes Mission 10 passaram com provedores e armazenamento simulados. A evidência transacional da Missão 10.5 continua sendo a referência do cache instalado.
- [Relatório da Missão 10.6](relatorios/MISSAO10_6_CONCORRENCIA_CUSTOS.md).

**Publicação desta execução:** RELATÓRIO NÃO PUBLICADO. Consulte o comando de publicação documental no relatório.

## Confirmação remota — código da Missão 10.6 publicado (2026-11-10)

- **PUBLICADO NO GITHUB:** dez arquivos de implementação, testes e proposta de migração da Missão 10.6 foram confirmados por comparação entre `f25889c` e a branch remota `feat/uppulse-missao10-supercatalogo`: um commit adicional, dez arquivos alterados, sem divergência de histórico. A indicação anterior de que o código estava somente no Codespaces está superada.
- **NÃO HOMOLOGADO:** a publicação do arquivo `migrations/mission10_research_coordination.sql` não significa que ele foi aplicado ao PostgreSQL. Permanecem pendentes autorização de migração, confirmação de backup atual, testes com duas conexões PostgreSQL reais e validação de recuperação de reservas órfãs após falha abrupta.
- **NÃO EXECUTADO NESTA VERIFICAÇÃO:** TypeScript, testes automatizados, build, acesso ao banco, chamadas pagas e deploy. A conferência foi de conteúdo e histórico GitHub.
- **PRIORIDADE:** concluir a Missão 10.6 antes de iniciar a Missão 11. Não repetir transferência de arquivos já versionados.

## Homologação PostgreSQL Missão 10.6 — confirmada em 2026-11-10
- Operador executou migração aditiva autorizada em `uppulse_catalog`, contêiner `beupfree-catalog-pg17`, PostgreSQL 17.11: `research_claims` e `research_budget` criadas em transação com COMMIT.
- Contagens antes e depois: 32.707 produtos, 96.851 ofertas, 16.945 projeções; nenhuma alteração nas contagens.
- Backup `/workspaces/backups/uppulse_catalog_pre_missao10.dump` (114.180.296 bytes) com índice e entradas TABLE DATA conferidas pelo pg_restore 17; restauração integral não comprovada.
- Testes do GitHub Actions reportados aprovados: TypeScript, testes Missão 10 e concorrência/orçamento em PostgreSQL efêmero. Execução real no Codespaces do script `scripts/mission10-6-homologate.sh`: `M10_6_HOMOLOGATION_SQL_ROLLBACK_OK` e `M10_6_HOMOLOGATION_COMPLETE`, zero linhas remanescentes em ambas as tabelas de controle. Esse script verifica regras SQL transacionais, não simula dois processos no banco de homologação.
- Pesquisas pagas seguem desativadas. Reserva órfã após falha abrupta ainda exige recuperação operacional segura; não declarar ativação de IA paga autorizada.
- Checkout local continua divergente (1 commit exclusivo local, 29 remotos na verificação anterior), com alterações locais; não executar pull/rebase/reset destrutivos.
- **Próxima prioridade: Missão 11**, iniciar aplicação e validar catálogo e UX com dados reais. Não bloquear o catálogo por ativação de IA paga.


## Missão 11.1 — validação executada no Codespaces (2026-11-12)
- Operador executou `scripts/mission11-1-real-preview-test.sh` com código remoto no commit `d385a98` em snapshot isolado `/tmp/uppulse-m11-ai-AeHhG5` e porta `5002`. A execução reportou `M11_1_REAL_CATALOG_AND_PLAYWRIGHT_OK`.
- Banco PostgreSQL existente estava acessível. GET `/api/products?limit=2` retornou `catalogSource: operational`, dois produtos e `total: 16945`. Produto utilizado na checagem: `02474478-a62e-40c8-8459-dd4deb47d5a0`.
- GET `/api/product-knowledge/<productId>` retornou `IDENTITY_ONLY`, Master ID correspondente e SuperHash `9f8964b20d0392db98f1c2e0b51860d200d0e9b099a1ad460d7e463f258e6299`. Isso confirma identidade calculada, **não** pesquisa/enriquecimento externos.
- Playwright no navegador real, com fixtures simuladas: **3 testes aprovados em 18,6 s**: filtros/recomendação/link, bloqueio de DEMO e ficha inteligente/SuperHash. Não confundir estes testes UI simulados com navegação completa no catálogo real.
- Não houve migração nem chamada paga; checkout local divergente preservado. Preview na aba PORTS → `5002` → Open in Browser.
- Próximo gate: conferir manualmente a experiência no preview com produtos reais, validar filtros e fluxo de oferta; auditar configuração de runtime e registrar eventuais erros. Pesquisa externa paga permanece desativada.
