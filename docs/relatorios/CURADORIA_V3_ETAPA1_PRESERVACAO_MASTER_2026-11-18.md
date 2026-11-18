# UpPulse — Curadoria V3, etapa 1: preservar e integrar o Produto Mestre

Data: 2026-11-18. Repositório `edineilemes-source/beupfree`. Branch `feat/uppulse-missao10-supercatalogo`.

**Status: IMPLEMENTADO e TESTADO no CI; integração com o banco e funcionamento visual ainda PENDING_HOMOLOGATION.** Não declarar concluída a Curadoria V3 inteira.

## Decisão não negociável

- **Não reimplementar** parser/matcher, segmentação do nome, cores, tamanhos, variantes, extração de modelo, geração, equivalência, GTIN, MPN, retrieval, heurísticas e agrupamentos do Produto Mestre; reutilizá-los como biblioteca.
- O subsistema original permanece em `shared/product-identity/parser.ts`, `matcher.ts`, `server/productIdentity/adapter.ts`, `candidates.ts`, `shadow.ts`, `grouping.ts`, `contracts.ts`, `operational.ts`, `jobs.ts`, `reader.ts`, `catalog.ts`, `reconciledReader.ts`.
- Versões originais lidas em `contracts.ts`: parser `product-identity-v1.5`, candidato `structural-first-bridge-token-dice-v1.5`, matcher `product-identity-v1.2`, agrupamento `complete-pair-check-v1`. Configurações, budgets e critérios permanecem originais.
- Casos e artefatos originais preservados, incluindo `shared/product-identity/identity.test.ts`, `v15.test.ts`, `validation/golden-v1.json`, `validation/labeling-v1.json`, `validation/v15-human-comparison.json`, `validation/v15-integrity.json`, `server/productIdentity/shadow.test.ts`, `v15.test.ts`, `v15-real-regression-fixture.json`, `commercialIsolation.test.ts`, `operational.test.ts`.
- Documentação histórica consultada: `shared/product-identity/README.md` e `HARDENING-V1.5.md`, que explicam preservação dos tokens desconhecidos, variantes, cores compostas, ausência de tamanho com sistema confiável, não equivalência automática de SKU, top-K e budgets.

## Código criado e integrado

1. `server/curationSources/masterPipeline.ts`: contrato versionado das etapas RECEIVED, TRIAGED, MASTER_IDENTIFIED, COMMERCIAL_VALIDATED, CLASSIFIED, VARIANTS_NORMALIZED, SEARCH_INDEXED, STORE_VISIBLE. Relatório baseado na cobertura de dados, sem assumir que há identidade vigente ou desconto válido. Carrega **as versões reais originais** diretamente dos módulos correspondentes.
2. `server/curationSources/masterParserPreview.ts`: chama **diretamente** `parseProductIdentity` da biblioteca histórica e `normalizeCatalogSize`/`normalizeCatalogColour` existentes. Não reescreve algoritmo nem inventa sistema de tamanho BR quando a fonte não o comprova; nenhum match ou escrita em banco.
3. `server/curationSources/awinFeedUpload.ts`: rota de auditoria agora retorna `pipeline` e `totalVariants` por merchant; nova rota `/merchant/:merchantId/master-preview` lê amostra real de 20 identidades/variantes no banco em transação `REPEATABLE READ READ ONLY`, com ID validado. Não muda importação AWIN nem tabelas Master.
4. `client/src/pages/AwinFeedUpload.tsx`: exibe fluxo versionado por etapa e botão de inspeção de até 20 identidades, mostrando nome, marca, modelo, geração, tamanho, cor e ambiguidades. Reutiliza a tela existente da Curadoria.
5. Testes `masterPipeline.test.ts`, `masterParserPreview.test.ts`: verificam que 5.167 ofertas não significam Master/publicação, cobertura parcial, versões, parser original, tamanho desconhecido e ausência de edição.
6. **Nenhum arquivo original de Produto Mestre foi editado**, nem regravados agrupamentos existentes.

## Verificações

- GitHub Actions `UpPulse Release Gate` SHA `d08f2f966956ecacf415b42acd2fb5da83e3dc16`, run `44330425674`: **SUCCESS**. Inclui TypeScript, testes unitários, política de catálogo público e build conforme workflow, antes deste commit documental.
- Novo preview da etapa 1 e consulta no banco real: validar via agente Codespaces. Não alegar que já executou antes do retorno.
- Nenhum SQL de escrita ou migração foi disparado por esta mudança. Banco original preservado.

## Próximas etapas de implantação (PENDENTE)

1. Conectar motor de ingestão da loja aos workers existentes com tarefas idempotentes e logs persistentes, conservando histórico de entrada, rejeições e versão de feed.
2. Orquestrar processamento Master por lotes com `planIdentityBatches`/`processIdentityJob`, preservando grupos atuais, orçamentos de comparação e revisão humana em ambiguidade; não ativar silenciosamente sobre a base compartilhada.
3. Reutilizar os classificadores e persistidores comerciais existentes e validar evidências de preço; só após isso materializar projeção do merchant e facet Loja.
4. Cadastro de novas fontes e agendador 2–3 vezes ao dia, com detecção de feed alterado, limites de rede, idempotência, reprocessamento e ausência segura de produtos.
5. Validar Olympikus 17698/51837 e demais lojas no banco real e UI sem gerar produtos Master duplicados. Requer gate de backup para qualquer migração e autorização para publicação de produção.

## Critério de saída

**Esta etapa** entrega preservação verificável do algoritmo original e primeiras interfaces executáveis de inspeção/administração. **Não significa** que os 5.167 itens Olympikus já passaram pelo processo Master, nem que foram publicados.
