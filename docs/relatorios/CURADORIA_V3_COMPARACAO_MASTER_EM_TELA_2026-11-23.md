# UpPulse — Curadoria V3: matcher do Produto Mestre executado na própria aplicação

Data: 23/11/2026. Repositório: `edineilemes-source/beupfree`. Branch: `feat/uppulse-missao10-supercatalogo`.

## Objetivo
Prosseguir com a integração da Curadoria automática sem reimplementar nem adulterar o Produto Mestre histórico e sem depender de colar feeds no ChatGPT. Nesta etapa, tornar o **matcher original** executável pela administração em consulta read-only, para homologação no Codespaces.

## Implementação
- `server/curationSources/masterShadowPreview.ts`: lê até 100 identidades de um anunciante, identifica marcas com o **parser histórico**, consulta até 100 identidades candidatas de outros anunciantes com essas marcas, aplica `loadSources`, `sourceInputs` e `runShadow` originais. Nenhuma reimplementação de `matcher`, `grouping`, `candidates`; nenhum produto fundido ou publicado.
- A consulta é amostral; alerta para fonte truncada, candidatos externos ausentes e limites de retrieval. Mesmo sem truncamento do anunciante, não equivale a comparação de todo o catálogo. Não serve como gate de publicação ou fusão automática.
- `server/curationSources/awinFeedUpload.ts`: endpoint administrativo `GET /api/admin/awin-feeds/merchant/:merchantId/master-shadow?limit=100` em transação `REPEATABLE READ READ ONLY`, com validação de identificador e limites.
- `client/src/pages/AwinFeedUpload.tsx`: botão da loja para executar o matcher histórico e exibir amostra, número de pares avaliados, candidatos de outras lojas, revisões e alertas de cobertura.
- `server/curationSources/masterShadowPreview.test.ts` e `server/curationSources/awinFeedUpload.test.ts`: limites, loja vazia, falta de publicação e autorização administrativa/HTTP read-only. Testes novos incluídos em `npm run test:unit`.
- Código Mestre original, tabelas comerciais, ofertas e projeção pública: **INALTERADOS**.

## Estado, riscos e próximos passos
- GitHub Actions: confirmar resultado do commit mais recente, após inclusão do teste de rota HTTP.
- Persistência da Curadoria V3 e handlers automáticos de classificação/projeção ainda não estão ativados: há proposta de migração não aplicada em `migrations/curadoria_v3_workflow_runs_PROPOSTA.sql`.
- Ponte Codespaces: issues #58/#59/#61/#62 estavam sem resposta. Codespaces não pode ser ligado diretamente pelo conector GitHub deste chat. Último erro conhecido do container de catálogo é conflito `runc` com volume preservado.
- Após reativação da ponte e do banco de homologação, validar o endpoint e a interface do commit homologado na porta 5013. Não declarar a porta aberta nem produto publicado sem teste HTTP.
- Para fluxo completo: motor de jobs do Produto Mestre com universo e membros ativos completos, normalização/preços/classificação idempotentes, projeção elegível, rotina de consulta remota de feeds e lista de rejeições persistente. Não aplicar migrações nem publicar na Hostinger sem gates.

**Status desta etapa: CÓDIGO IMPLEMENTADO; HOMOLOGAÇÃO REAL DO CODESPACES PENDENTE.**
