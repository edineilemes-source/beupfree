# Curadoria V3 — triagem automática de feeds com Produto Mestre original

**Data:** 2026-11-23. **Repo:** `edineilemes-source/beupfree`. **Branch:** `feat/uppulse-missao10-supercatalogo`.

## Contrato de negócio

Uma nova loja recebe feed AWIN ou upload, e a aplicação deve: reconhecer anunciante/feed, validar arquivo, decidir elegibilidade, inspecionar identidade Master, gravar staging, classificar, vincular Master, validar atributos/comercial, publicar na projeção, expor no filtro Loja e atualizar periodicamente. Nenhuma intervenção manual rotineira: apenas exceções reais (ambiguidade, fonte inválida, risco de equivalência/preço).

**Status real desta execução: TRIAGEM/DIAGNÓSTICOS AUTOMÁTICOS EM CÓDIGO; PUBLICAÇÃO DE PONTA A PONTA NÃO IMPLEMENTADA NESTA ETAPA.**

## Código implementado

- `server/curationSources/automatedDecision.ts`: decisão determinística por produto baseada no `assessAwinCatalogCandidate` original, `parseProductIdentity` histórico, `normalizeCatalogSize`, `normalizeCatalogColour`, `classifyAudience`. Preserva modelo, geração, tokens e ambiguidades; **não inventa sistema de tamanho e não decide fusão**. Resultado STAGE/REVIEW/REJECT é de triagem, não publicação.
- `server/curationSources/awinFeedUpload.ts`: no recebimento AWIN, executa parser histórico para cada item normalizado, conta os candidatos e captura ambiguidades; arquivo de relatório versionado `.master-v15.json` sem sobrescrever relatórios anteriores. API administrativa para listar revisões do Master paginadas, preservando rotas comerciais.
- `client/src/pages/AwinFeedUpload.tsx`: exibe a contagem de inspeções automáticas, razões e lista paginada de ambiguidades no resultado da importação.
- `server/curationSources/automatedDecision.test.ts` e atualização de `server/curationSources/awinFeedUpload.test.ts`: paridade com parser Mestre e auditoria HTTP idempotente, sem publicação.
- Código anterior de listagem de lojas/feeds e inspeção da Curadoria V3 continua em uso.
- **Sem alterações** em `shared/product-identity/parser.ts`, `matcher.ts`, `server/productIdentity/candidates.ts`, `shadow.ts`, `grouping.ts` ou no estado atual do banco.

## Situação do fluxo completo

1. Upload AWIN: existente, audita automaticamente e inicia importação em staging pelo frontend; códigos desta etapa adicionam inspeção Master.
2. Produto Mestre persistido: **pendente** de worker idempotente seguro por loja/escopo, preservando membros/grupos existentes e limites de candidatos. O `processIdentityJob` atual usa universo completo e não deve ser disparado automaticamente para cada feed sem limitar/validar o escopo.
3. Classificações, evidência de preço e normalizações: existem adaptadores e scripts, mas não estão conectados ao upload numa operação protegida e transacional única. `scripts/awin-regular-catalog-stage.ts` exige pré-condições de migração e versão e recusa dados já presentes; reexecução segura deve ser projetada.
4. Projeção/vitrine e filtro Loja: já existem, mas só devem refletir produtos após conferência comercial e de identidade aplicável. **Não publicar 5.167 ofertas Olympikus sem gate**.
5. Atualização 2–3 vezes/dia, alterações de estoque, retiradas e recuperação: **não implementadas**.
6. Rejeições: razões por linha da triagem já existentes, agora com relatório de ambiguidades do parser Master. Histórico persistente de cada execução e reprocessamento automatizado ainda precisa de implantação.
7. Validação real do banco e preview está bloqueada enquanto o agente Codespaces não responder e o contêiner catalog Postgres não estiver verificado. Consultas GitHub Issues #58 e #59 ainda não retornaram na ocasião da revisão. Sem execução no banco por esta missão.

## Próxima implementação obrigatória

Orquestrador da Curadoria V3, com registros persistentes de jobs/checkpoints/rejeições, worker pós-importação **por anunciante + feed**, versões e idempotência, proteção contra dois jobs concorrentes, integração ao motor Master original, persistência de classificações/normalizações/evidências e projeção somente elegível com revisão comercial. Em seguida agendador de feeds remoto. Toda migração depende de aprovação do esquema, backup e testes.

**Não declarar curadoria de ponta a ponta ou publicação automática pronta.**
