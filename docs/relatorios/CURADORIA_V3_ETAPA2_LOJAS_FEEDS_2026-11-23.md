# Curadoria V3 — etapa 2, retomada em 23/11/2026

Repo `edineilemes-source/beupfree`; branch `feat/uppulse-missao10-supercatalogo`.

Status: **IMPLEMENTADO EM CÓDIGO; AGUARDA TESTES CI E HOMOLOGAÇÃO NO CODESPACES**.

## Fonte da retomada
- `docs/relatorios/CURADORIA_V3_ETAPA1_PRESERVACAO_MASTER_2026-11-18.md`, `docs/ESTADO_OPERACIONAL.md`, `.ai/NEXT_ACTION.md` e código do Produto Mestre foram consultados diretamente no GitHub.
- Release Gate da etapa 1 passou em 18/11, workflow run `44330425674`, SHA `d08f2f966956ecacf415b42acd2fb5da83e3dc16`.
- A última Issue técnica #57 informou Docker ativo, porém `beupfree-catalog-pg17` parado. O operador depois relatou erro de runc no `docker start`; nenhum resultado posterior comprovando recuperação do banco foi encontrado no GitHub.
- Em 23/11, Issues [#58](https://github.com/edineilemes-source/beupfree/issues/58) (STATUS) e [#59](https://github.com/edineilemes-source/beupfree/issues/59) (DIAGNOSTICO) foram abertas para o agente restrito; **ainda sem resposta na conferência inicial**, portanto não declarar agente ativo.

## Código implementado nesta etapa
- `server/curationSources/storeRegistry.ts`: leitura multi-marketplace dos `commerce_merchants`, `commerce_providers` e `commerce_feeds`, com identificação e últimos horários de importação. Sem tabela nova, conexão externa, integração ou SQL mutável.
- `server/curationSources/awinFeedUpload.ts`: adiciona `GET /api/admin/awin-feeds/stores` protegido pelo middleware administrativo existente e transação `REPEATABLE READ READ ONLY`; preserva rotas/algoritmos existentes.
- `client/src/pages/AwinFeedUpload.tsx`: apresenta lojas reais e seus feeds; botão para auditar por anunciante usando a funcionalidade já existente da Curadoria. Não anuncia agendamento ou atualização automáticos que ainda não existem.
- `server/curationSources/storeRegistry.test.ts`: teste de múltiplas lojas, múltiplos feeds e somente leitura.
- **Nenhum arquivo de** `shared/product-identity/` **ou** `server/productIdentity/` **foi alterado**. Parser V1.5, matcher V1.2, retrieval, grouping e regressões preservados.

## Critérios pendentes
- Consultar resultado do CI do SHA da etapa 2. Falha exige corrigir o GitHub e nova execução, não simplificar testes.
- Verificar status do agente e recuperar o contêiner sem apagar o volume `beupfree-catalog-pg17-data`; recuperação de runc não é autorizada ao agente restrito de Issues.
- Homologar `/api/admin/awin-feeds/stores` no banco real e a tela em preview, após recuperação.
- Continuar cadastro/configuração de novas fontes, periodicidade por loja, orquestrador idempotente, rejeições, execução segura do Produto Mestre histórico, classificação, preços e projeção. Isso **não está concluído**.
- Não publicar produtos/Hostinger ou executar migração sem os gates correspondentes.
