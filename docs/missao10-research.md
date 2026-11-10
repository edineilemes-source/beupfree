# Missão 10 — pesquisa externa (primeiro adaptador real)

O módulo `server/productIntelligence/liveProvider.ts` implementa a interface `ResearchProvider` com busca Tavily e extração estruturada OpenAI. **Ainda não há rota pública, persistência no PostgreSQL nem execução automática.** Nenhuma chamada externa ocorre sem invocação explícita e credenciais.

## Credenciais (somente servidor)

- `TAVILY_API_KEY`: chave de pesquisa Tavily
- `OPENAI_API_KEY`: chave da API OpenAI (cobrada separadamente da assinatura ChatGPT)
- `OPENAI_RESEARCH_MODEL` (opcional): modelo de extração; padrão `gpt-4o-mini`

Não registrar chaves em Git, arquivos versionados, logs ou interface. Para integração futura, construir `createLiveResearchProvider({tavilyApiKey: process.env.TAVILY_API_KEY ?? "",openaiApiKey:process.env.OPENAI_API_KEY ?? "",openaiModel:process.env.OPENAI_RESEARCH_MODEL})` somente no servidor.

## Restrições

- Busca limitada a 5 fontes e até 30 campos por fonte.
- A extração usa o trecho retornado pela busca, não o conteúdo integral da página. Ausência de evidência não equivale a especificação comprovada.
- URLs de fontes devem ser HTTPS; a IA não pode inventar URLs nem decidir fusões de Master IDs.
- Divergências permanecem sinalizadas, não são resolvidas automaticamente.
- Cache de produção e persistência precisam ser implementados antes de habilitar pesquisas em massa.
- Exige validação dos termos de uso das fontes e medição de custo antes de automação.

## Verificação

`npm run check && npm run test:mission10`

Os testes usam HTTP simulado; não gastam créditos e não verificam disponibilidade de APIs reais.
