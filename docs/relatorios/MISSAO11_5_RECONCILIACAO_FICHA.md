# Missão 11.5 — Reconciliação técnica com evidências reais, sem novas chamadas

Estado em 2026-11-16: **IMPLEMENTADO NA BRANCH; AINDA NÃO EXECUTADO NO CODESPACES**.

O operador apresentou as 10 características extraídas via Tavily/OpenAI de três sites especializados (Believe in the Run, Alastair Running e Doctors of Running). Os seis campos `CONFLICT` originais incluem:

- `drop`: 6 mm, 6mm, 6.5 mm → 2 fontes concordam em **6 mm**, a terceira informa **6,5 mm**; continua `CONFLICT`.
- `altura_do_solado`: 38 mm calcanhar/32 mm antepé em dois formatos; outra fonte 37 mm/30,5 mm → **maioria parcial de duas fontes, mas permanece CONFLICT**.
- `peso`: fontes citam 224 g (US M9), 235 g sem mesma numeração, 230 g (US M9), além de pesos femininos. **Não é seguro conciliar valores distintos ou tamanhos diferentes.**
- `indicacao_de_uso`, `material`, `tecnologia`: descrições de uso e componentes não idênticas podem ser complementares ou contextuais; **não serão fundidas por heurística**.
- `amortecimento`, `cabedal`, `entressola`, `solado` têm evidências de fonte única: não promover como verificadas.

Mudanças:
- `technicalNormalization.ts`: padroniza *somente* drop e medidas calcanhar/antepé, com grupos de concordância e URLs originais preservados; não tenta reconciliar peso, material nem marketing. Não oculta a divergência de 6,5 mm.
- `superCatalog.ts`: adiciona grupos opcionais `agreements`, mantém `CONFLICT` quando ainda existem valores numéricos distintos.
- `reportReconciliation.ts`: recalcula grupos a partir do **relatório V2 salvo**, sem consumo de créditos, sem edição no arquivo original, sem banco de dados.
- Endpoint `/api/product-knowledge/pilot/live-evo-sl-v2` apresenta seção `reconciled` apenas em ambiente de desenvolvimento; UI expõe contagem das concordâncias e divergências lado a lado.
- Testes `technicalNormalization.test.ts` e `reportReconciliation.test.ts` usam valores exatos fornecidos pelo operador.
- Script `scripts/mission11-5-reconcile-v2-offline.sh` valida TS/testes, lê `/tmp/uppulse-evo-sl-real-research-v2.json` e abre preview isolado na **porta 5008**, sem chamadas externas.

**Aprovação comercial ainda NÃO concedida.** Dois grupos têm maioria parcial, mas a ficha ainda possui diferenças substanciais; não associar automaticamente um modelo de teste ao Master comercial.

Próxima ação: executar o script offline após `git fetch`; inspecionar resultados e decidir sobre normalização de tecnologias em estruturas multi-valor / peso com numeração e sexo, preservando requisitos de proveniência.
