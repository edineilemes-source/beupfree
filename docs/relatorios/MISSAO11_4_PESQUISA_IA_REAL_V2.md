# Missão 11.4 — Segunda rodada de pesquisa real Evo SL

**Estado:** implementação publicada na branch; **execução real V2 e testes no Codespaces ainda pendentes**.

## Base real anterior
O primeiro piloto executou 1 Tavily e 3 OpenAI, encontrou 5 candidatos (3 páginas adidas, um vídeo do YouTube, uma página de conhecimento Tavily), selecionou 3 domínios e extraiu 4 campos técnicos de apenas 1 fonte. O HTTP direto aos três varejistas havia retornado 403. Há um relatório V1 preservado em `/tmp/uppulse-evo-sl-real-research.json`.

## Correções implementadas
- `sourceSelection.ts`: classificação técnica de resultados, exigência de marca/modelo explícitos, preferência por termos de especificações, rejeição de YouTube/Tavily institucional e URLs inadequadas; no máximo uma fonte do fabricante mesmo quando aparece em domínios internacionais diferentes.
- `liveProvider.ts`: busca Tavily pode receber até 10 resultados por chamada, com limite explícito e trechos associados às URLs reais.
- `scripts/mission11-4-evo-sl-live-v2.ts`: **duas buscas Tavily com consultas técnicas diferentes** e **até três extrações OpenAI**. Usa o orquestrador existente; guarda candidatos com motivos, fontes escolhidas e número de campos por fonte em arquivo local V2.
- `server/productIntelligence/knowledgeRoutes.ts` e `client/src/components/EvoSlPilot.tsx`: relatório V2 disponível somente em desenvolvimento, para comparação visual entre rodadas.
- `scripts/mission11-4-run-v2-once.sh`: snapshot isolado Git, compila e roda testes direcionados antes de APIs pagas, recusa repetição pelo lock local e cria preview separado na porta 5007 com pesquisas pagas desativadas. O relatório é preservado mesmo quando a qualidade ainda não for suficiente.
- Novos testes `sourceSelection.test.ts`, incluindo inadmissibilidade de contar adidas.com e adidas.com.br como duas fontes independentes.

## Custos, autorização e limites
- Apenas um modelo (Adidas Adizero Evo SL); no máximo **2 Tavily + 3 OpenAI**, sujeitas a tarifas das respectivas plataformas. Script exige chaves presentes somente no Codespaces e deve ser executado por operador autorizado.
- Não altera dados comerciais, não faz merge de Master, não escreve em cache PG, não dispara pesquisas em lote e não publica em produção.
- Qualidade só aprovada quando **pelo menos 2 domínios com evidências técnicas** e **1 campo VERIFIED**; continuam necessários revisão humana da identidade e comparação de versões/códigos.

## Próximo passo
Executar `git fetch origin feat/uppulse-missao10-supercatalogo`, seguido de `git show origin/feat/uppulse-missao10-supercatalogo:scripts/mission11-4-run-v2-once.sh | bash`. O script fará testes sem custo antes das requisições. Avaliar relatório V2 na porta 5007 e decidir se a abordagem via trechos indexados é suficiente ou se o passo seguinte deve usar Tavily Extract / fontes estruturadas de fabricantes.
