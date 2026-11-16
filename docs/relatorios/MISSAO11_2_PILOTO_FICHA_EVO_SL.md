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


## Missão 11.3 — habilitação controlada de IA REAL (2026-11-16)
- Implementado `scripts/mission11-3-evo-sl-live-research.ts`: utiliza **Tavily API real** para buscar candidatos, escolhe até três URLs HTTPS de domínios distintos cujo título/trecho mencione o modelo Evo SL, chama **OpenAI API real** até três vezes para extrair atributos fundamentados nos trechos retornados e consolida via `enrichProduct` e `createSuperCatalogCard`.
- O orçamento deste **piloto CLI único** é uma reserva local fail-closed: no máximo **1 Tavily + 3 OpenAI**. O limite é de chamadas, não garantia de preço, já que tarifas variam. Um script adicional `scripts/mission11-3-run-real-once.sh` verifica a existência das credenciais no Codespaces, compila a branch antes de chamar APIs e recusa repetição após a primeira tentativa por meio de lock local. Somente a opção CLI `--execute` autoriza chamada externa. Nenhuma rota pública realiza pesquisa ou cobra créditos.
- Relatório salvo em `/tmp/uppulse-evo-sl-real-research.json`, com links efetivamente retornados, contagem de requisições, campos, status, conflitos e avisos. Sem credenciais, texto integral das respostas ou dados sensíveis. API `GET /api/product-knowledge/pilot/live-evo-sl` somente em desenvolvimento permite leitura desse relatório na ficha, sem novas cobranças; botão `Ver resultado da IA real`.
- O adaptador já existente Tavily+OpenAI é reutilizado. **Não foi executado neste chat**, pois as chaves estão no Codespaces e não podem ser acessadas via conector GitHub. Resultado concreto da pesquisa real, quantidade de fontes alcançadas e eventual cobrança devem ser confirmados pela execução no Codespaces. O HTTP 403 dos três varejistas na coleta Node direta não significa, por si, que a Tavily também será bloqueada.
- Não escreve em `product_intelligence_cache`, não altera catálogo comercial, master, preço ou oferta. Não faz deploy, não ativa `RESEARCH_PAID_ENABLED` globalmente e não introduz pesquisa pública irrestrita.
