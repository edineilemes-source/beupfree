# Missão 11.2 — Piloto de ficha técnica Adidas Adizero Evo SL

Estado: **IMPLEMENTADO / TESTE PENDENTE NO CODESPACES**, em 2026-11-16.

## Objetivo
Avaliar a utilidade de consolidar informações técnicas de três páginas reais antes de autorizar pesquisas pagas em escala.

## Entrega
- Fontes reais identificadas: página oficial adidas KJ1363, Centauro EVO SL masculino, Netshoes EVO SL masculino. URLs exatas registradas em `server/productIntelligence/evoSlPilot.ts`.
- Conjunto de evidências **pré-extraído manualmente** dessas páginas: fonte, campo, valor, status e código quando disponível. A consolidação passa por `enrichProduct` (orquestrador real) com um ResearchProvider **simulado** que devolve três fontes pré-extraídas; ele chama a função existente `createSuperCatalogCard`, mantendo divergências. Não executa Tavily/OpenAI. Uma fonte independente é somente domínio diferente, não prova editorial.
- Endpoint GET `/api/product-knowledge/pilot/evo-sl` apenas em desenvolvimento, sem escrita de catálogo, sem pesquisa paga. Isolado do Master comercial por ID `pilot-evo-sl-not-a-commercial-master`.
- Componente `EvoSlPilot.tsx` acessível em **Ficha inteligente e fornecedores** em ambiente DEV. Exibe síntese experimental, métricas, campos, divergências, referências e limitações.
- Testes unitários (`server/productIntelligence/evoSlPilot.test.ts`) e Playwright de laboratório adicionados; script `scripts/mission11-2-evo-sl-pilot.sh` usa snapshot Git isolado, porta 5005, `npm run check`, testes unitários, smoke HTTP e Playwright. Verifica também se os três sites respondem a GET sem login/APIs pagas, sem armazenar seu conteúdo.

## Limitações
- **Não implementa coleta automática real, extração por LLM, nem gravação da ficha no PostgreSQL**. Os campos demonstrativos têm origem em leitura prévia de páginas reais; o clique apenas calcula a consolidação. Essa distinção aparece explicitamente na interface.
- Não representa diagnóstico do catálogo de 16.945 itens nem valida preço/estoque das três páginas externas.
- Não afirma que todos os campos concordam; peso de determinada variante não pode ser propagado a outras.
- Testes ainda **não executados no Codespaces** nesta etapa; aguardar resultado do script antes de declarar homologação.

## Próximo gate
Rodar script da porta 5005, verificar métricas/falhas de acesso, inspecionar ficha no browser. Com a evidência, decidir pequeno piloto automático de pesquisa paga de 1 produto sob orçamento aprovado, com proteção e auditoria, antes de qualquer escala.


## Resultado real do piloto informado pelo operador — 2026-11-16
- O operador rodou o script `scripts/mission11-2-evo-sl-pilot.sh` com fonte `70b2a8a`: `npm run check` aprovado; **2/2 testes unitários aprovados**.
- PostgreSQL `beupfree-catalog-pg17`: `CATALOG_POSTGRES_READY after attempt 1`. Preview isolado iniciou na porta 5005, sem publicação em produção.
- Acesso HTTP direto às três páginas: `www.adidas.com.br`, `www.centauro.com.br` e `www.netshoes.com.br` responderam **403**. Isto bloqueia a coleta direta por esse método; não indica que a consolidação deixou de funcionar.
- API `/api/product-knowledge/pilot/evo-sl`: `PILOT_3_SOURCES_OK`, **11 campos identificados, 4 com concordância, 4 de fonte única e 3 com divergência textual**.
- Na primeira execução o Playwright não selecionou testes devido ao `--grep` incorreto; corrigido em `805f322`. O operador executou `scripts/mission11-2-pilot-ui-recheck.sh` na fonte `1eb22bc` e obteve **`1 passed (14.9s)` / `EVO_SL_PILOT_UI_OK`**.
- **Estado comprovado**: piloto de consolidação com evidências pré-extraídas e interface de laboratório homologado na porta 5005; coleta/extracão automática real, chamada Tavily/OpenAI, escrita da ficha enriquecida no PostgreSQL e validação de relevância de três fontes continuam pendentes. O Playwright usa interceptação/mocks da API de laboratório; smoke HTTP da API real foi executado separadamente.
