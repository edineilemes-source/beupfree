# UpPulse — Auditoria Olympikus e integração à loja/filtros

Data: 2026-11-17 (Campo Grande–MS).
Repositório: `edineilemes-source/beupfree`.
Branch: `feat/uppulse-missao10-supercatalogo`.
Estado: **IMPLEMENTADO, AGUARDANDO HOMOLOGAÇÃO DOS DADOS DE OLYMPIKUS**.

## Evidência confirmada

- Agente restrito Codespaces, issue [#54](https://github.com/edineilemes-source/beupfree/issues/54), verificou contagens gerais do banco `beupfree-catalog-pg17` após importação: `products=33520`, `offers=102018` e `catalog_search_products=16945`.
- Baseline anterior do mesmo banco (issue #44): `products=32707`, `offers=96851` e `catalog_search_products=16945`. Diferença: +813 linhas de produtos, +5.167 ofertas e **nenhum registro novo na projeção de busca**.
- As diferenças globais são compatíveis com o processamento informado de 5.167 ofertas Olympikus/AWIN (`external_merchant_id=17698`, feed `51837`), mas **não são prova isolada de atribuição por merchant**, nem de Produto Mestre concluído. É necessária consulta por merchant.
- Uma consulta antiga com `-d postgres` falhou porque a relação `commerce_merchants` não existe nesse banco. A fonte canônica anterior é `uppulse_catalog` no contêiner acima; o novo endpoint usa a mesma `DATABASE_URL` do servidor preview verificado.

## Arquitetura e análise

1. Upload AWIN (`server/curationSources/awinFeedUpload.ts`) persiste exclusivamente itens aceitos para **staging**, não faz publicação na vitrine.
2. Classificação operacional, normalização de variantes, evidências comerciais e projeção de busca são etapas **separadas**, com scripts existentes, validações e gates de migração.
3. Produto Mestre usa o subsistema lateral `server/productIdentity`; na importação AWIN a notificação só é enfileirada quando `MASTER_IDENTITY_ENABLED=true`, não comprovado no preview. Ter produto/oferta comercial não certifica Master reconciliado ou vigente.
4. O filtro `Loja` já existe: seleção URL `merchant=...`, `server/catalogSearchProjection/repository.ts` lê `commerce_merchants.name` e cria facets por loja a partir de `catalog_search_products`. `server/publicCatalog/operational.ts` expõe o nome da loja em cartões e ofertas. **Não adicionar opções fixas fora da projeção**, pois isso daria filtro vazio/incorreto.
5. `readMaster` requer evidência vigente de identidade e critérios comerciais adicionais; contar memberships não é provar toda a equivalência.

## Implementação nesta missão

- Rota de auditoria **read-only** `GET /api/admin/awin-feeds/merchant/:merchantId/audit`, no servidor de Curadoria, com transação `REPEATABLE READ READ ONLY`; valida ID, verifica existência de tabelas, identifica merchant e conta por anunciante: ofertas/identidades, membership Master, classificações, variantes normalizadas, evidências de preço e projeção disponível.
- Painel na tela `/admin/curadoria/feeds`: consulta por ID AWIN; exibe cada etapa e sinaliza pendências; oferece link direto para catálogo filtrado por `merchant=` somente quando a projeção contém itens.
- Teste simulado do endpoint read-only sem banco real e teste do filtro/visibilidade de Olympikus após projeção disponível.
- Multi-marketplace preservado; nenhuma alteração comercial ou migratória no PostgreSQL por esta missão.

## Pendências para permitir Olympikus na vitrine

- Validar números e cobertura **por merchant** no banco pela nova rota, incluindo produtos com Master atual, preços verificados e normalizações.
- Homologar/aplicar **somente após gate de backup e autorização** as migrações exigidas para preço regular, se ausentes, sem violar ofertas pré-existentes.
- Executar classificação, evidência de preços, normalização e reconciliação do Produto Mestre com lotes seguros e revisão de ambiguidades. Não inventar ofertas promocionais nem equivalência entre produtos.
- Gerar projeção da Olympikus no catálogo apenas para elegíveis, conferir contagens e filtros `Loja`, `Marca`, modalidade, cores, gênero, tamanho, preço e links de afiliação.
- Testar end-to-end no preview com dados reais. Não executar em Hostinger nem publicar produção sem outro gate.

## Segurança e risco

O preview atual dispõe de modo temporário sem login apenas em desenvolvimento, sujeito a visibilidade **Private** da porta. O endpoint de auditoria tem a mesma proteção de rota administrativa do upload. Nenhum SQL de escrita na auditoria. **Não declarar Produto Mestre/processamento comercial/publicação homologados enquanto a verificação por merchant não confirmar**.
