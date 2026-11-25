# Próxima ação — 2026-11-10 (após migração da Missão 10)

```yaml
originating_mission: MISSAO10.3-CACHE-PG
recommended_next_mission: "Homologar leitura/escrita do cache PostgreSQL com Master ID real, dados sintéticos e ROLLBACK; em seguida integrar o adaptador ao fluxo da aplicação."
reason: "Migração autorizada aplicada com COMMIT; tabela product_intelligence_cache criada com 3 índices e zero registros; contagens de products, offers e catalog_search_products preservadas."
requires_user_decision: false
requires_chatgpt_review: true
```

- Referência: [docs/ESTADO_OPERACIONAL.md](../docs/ESTADO_OPERACIONAL.md).
- Relatório: [docs/relatorios/MISSAO10_3_MIGRACAO_CACHE_2026-11-10.md](../docs/relatorios/MISSAO10_3_MIGRACAO_CACHE_2026-11-10.md).
- Não rodar novamente a migração como se ainda estivesse pendente; não usar db:push; não disparar chamadas pagas para testar persistência.


## Atualização posterior — 2026-11-10: Missão 10.5

A homologação transacional PostgreSQL **foi aprovada no terminal normal do Codespaces**: `node --import tsx scripts/mission10-postgres-integration.ts` retornou `MISSÃO 10.5: integração PostgreSQL aprovada e registro sintético ausente após ROLLBACK`. A recomendação antiga no bloco YAML acima está superada quanto ao teste do cache real.

**Próxima ação efetiva:** revisar o diff local de `server/productIntelligence/postgresResearch.ts`, `server/productIntelligence/postgresCache.ts`, `server/productIntelligence/postgresCache.test.ts` e `scripts/mission10-postgres-integration.ts`; conferir segurança e testes; solicitar autorização explícita para commit/push de código. O código permanece apenas no Codespaces. Depois, planejar integração ao consumidor de aplicação/UI e controle de custos/concorrência. Não executar migrações, `db:push`, chamadas pagas nem deploy sem autorização.

Referência: [relatório da Missão 10.5](../docs/relatorios/MISSAO10_5_INTEGRACAO.md).


## Atualização mais recente — Missão 10.6 autorizada, 2026-11-10

O código da Missão 10.5 **já foi publicado** no commit `8afe2dd` na branch `feat/uppulse-missao10-supercatalogo`; a indicação anterior de código apenas local está superada. A homologação PostgreSQL transacional ocorreu antes dos ajustes finais do script, sem segunda execução real após os ajustes.

**Próxima ação:** executar a [Missão 10.6 — concorrência e custos](../docs/missoes/MISSAO10_6_CONCORRENCIA_CUSTOS.md). O Codex deve publicar somente o relatório `docs/relatorios/MISSAO10_6_CONCORRENCIA_CUSTOS.md`, este estado e `docs/ESTADO_OPERACIONAL.md`, conforme `AGENTS.md`. Código e migrações requerem autorização posterior. Não chamar APIs pagas ou executar migrações.

## Atualização — Missão 10.6 implementada localmente, 2026-11-10

A coordenação e o orçamento passaram em testes simulados. A homologação multi-instância permanece pendente. Revisar a proposta de migração, confirmar backup e obter autorização explícita antes de aplicá-la. Após autorização, testar coordenação, falha, recuperação e orçamento com dois clientes PostgreSQL e provedores simulados. Manter as APIs pagas desabilitadas. Código, testes e migração permanecem locais.

[Relatório e estado da publicação documental](../docs/relatorios/MISSAO10_6_CONCORRENCIA_CUSTOS.md).

**Publicação desta execução:** RELATÓRIO NÃO PUBLICADO. Consulte o comando de publicação documental no relatório.

## Prioridade de produto — Missão 11 (2026-11-10)

**Esta seção substitui as recomendações anteriores como próxima ação.** O foco agora é **colocar a aplicação no ar no preview, validar o catálogo real, integrar novos parceiros e evoluir o layout**, sem ficar repetindo a Missão 10.6. Plano operacional: [Missão 11 — retomada da aplicação, catálogo e layout](../docs/missoes/MISSAO11_RETOMADA_APLICACAO_CATALOGO_LAYOUT.md).

O relatório 10.6 já está publicado no GitHub. Seu código permanece local no Codespaces; não executar rebase/reset/force-push sobre esse checkout. A documentação GitHub não prova que o servidor HTTP esteja ativo. Preservar dados, não executar migração 10.6 nem API paga. Próxima evidência desejada: URL/porta de preview respondendo e navegação real catálogo → oferta, seguida de relatório de falhas e correções.

## Correção de prioridade — concluir a Missão 10.6 antes da 11 (2026-11-10)

**Esta seção é a orientação vigente e substitui a prioridade de retomada imediata da Missão 11.** Por decisão expressa do operador, encerrar primeiro a Missão 10.6: preservar o código/testes/migração ainda locais, revisar e publicar código com segurança sem sobrescrever a branch remota, revisar o SQL, confirmar backup e obter autorização antes de aplicar migração, homologar concorrência e orçamento com conexões PostgreSQL reais e provedores simulados, validar recuperação de reservas órfãs e registrar resultados verificáveis. Não ativar chamadas pagas nem realizar deploy. A Missão 11 já documentada fica **adiada**, não cancelada; retomá-la após o fechamento técnico da 10.6.

**Atenção ao checkout:** existem mudanças não commitadas e um commit local documental divergente; não usar rebase com working tree suja, reset, stash, force-push ou worktree nova para substituir o código local da 10.6. O conector GitHub não lê os arquivos ainda não versionados no Codespaces. Publicação documental 10.6 confirmada em `51cafac`, com retificação posterior.

## Próxima ação vigente — Missão 11 após homologação 10.6 (2026-11-10)
A migração aditiva 10.6 foi aplicada com autorização ao PostgreSQL de homologação e as contagens comerciais permaneceram iguais. O teste transacional real concluiu `M10_6_HOMOLOGATION_COMPLETE`, sem resíduos de teste. GitHub Actions reportado aprovado para TypeScript, testes unitários e integração PostgreSQL efêmera. O backup foi verificado por índice, não por restauração integral. Pesquisa paga continua desligada e a recuperação automática de claims órfãs não está homologada; tratar como pendência operacional, sem impedir o catálogo.
**Executar agora a Missão 11**: inicializar e verificar o UpPulse no Codespaces, navegar catálogo real Dafiti/FutFanatics, corrigir UX, preservar a branch local divergente e os arquivos não commitados. Referência: `docs/missoes/MISSAO11_RETOMADA_APLICACAO_CATALOGO_LAYOUT.md`. Não executar `git pull`, `reset`, `rebase` ou migrações adicionais sobre o checkout divergente.


## Missão 11.1 — validação executada no Codespaces (2026-11-12)
- Operador executou `scripts/mission11-1-real-preview-test.sh` com código remoto no commit `d385a98` em snapshot isolado `/tmp/uppulse-m11-ai-AeHhG5` e porta `5002`. A execução reportou `M11_1_REAL_CATALOG_AND_PLAYWRIGHT_OK`.
- Banco PostgreSQL existente estava acessível. GET `/api/products?limit=2` retornou `catalogSource: operational`, dois produtos e `total: 16945`. Produto utilizado na checagem: `02474478-a62e-40c8-8459-dd4deb47d5a0`.
- GET `/api/product-knowledge/<productId>` retornou `IDENTITY_ONLY`, Master ID correspondente e SuperHash `9f8964b20d0392db98f1c2e0b51860d200d0e9b099a1ad460d7e463f258e6299`. Isso confirma identidade calculada, **não** pesquisa/enriquecimento externos.
- Playwright no navegador real, com fixtures simuladas: **3 testes aprovados em 18,6 s**: filtros/recomendação/link, bloqueio de DEMO e ficha inteligente/SuperHash. Não confundir estes testes UI simulados com navegação completa no catálogo real.
- Não houve migração nem chamada paga; checkout local divergente preservado. Preview na aba PORTS → `5002` → Open in Browser.
- Próximo gate: conferir manualmente a experiência no preview com produtos reais, validar filtros e fluxo de oferta; auditar configuração de runtime e registrar eventuais erros. Pesquisa externa paga permanece desativada.


## Piloto 11.2 — Evo SL (2026-11-16)
- O laboratório de enriquecimento da ficha foi implementado na branch remota: botão `Testar ficha Evo SL — 3 fontes` no painel existente, visível apenas em desenvolvimento. Endpoint `/api/product-knowledge/pilot/evo-sl` desativado em produção.
- Três fontes públicas reais (adidas Brasil KJ1363, Centauro masculino, Netshoes masculino) deram origem a um **conjunto pré-extraído de evidências**, que é processado pelo orquestrador `enrichProduct` com provedor simulado. Mostra síntese, atributos, URLs, concordância e conflito. Não coleta automaticamente páginas, não faz inferência LLM ao clicar, não grava no PostgreSQL nem chama APIs pagas.
- O script `scripts/mission11-2-evo-sl-pilot.sh` prepara snapshot isolado, executa TypeScript, unitário e Playwright, verifica endpoint e realiza um único GET de teste por fonte para medir acessibilidade HTTP; preview porta 5005, preservando 5000–5004. **Execução e homologação pendentes** da saída do Codespaces. Relatório `docs/relatorios/MISSAO11_2_PILOTO_FICHA_EVO_SL.md`.
- Próximo gate após testes: protótipo de extração automática limitado a um único Master confirmado e três fontes, sob autorização explícita se houver APIs pagas; critérios de identidade, fontes, conflitos, custo e persistência.


## Próxima ação — Missão 11.3: IA externa real, somente um Evo SL (2026-11-16)
- Usuário autorizou um teste real da dupla Tavily/OpenAI, não apenas pré-extração simulada. Script remoto `scripts/mission11-3-run-real-once.sh` deve ser executado no Codespaces depois de `git fetch`; precisa de `TAVILY_API_KEY` e `OPENAI_API_KEY` disponíveis apenas no ambiente, sem exibi-las.
- O executor `scripts/mission11-3-evo-sl-live-research.ts --execute` limita a **1 pesquisa Tavily e 3 extrações OpenAI**, registra URL dos candidatos, URLs selecionadas, atributos com evidências e erros em `/tmp/uppulse-evo-sl-real-research.json`. Não altera banco; lock evita repetir cobrança sem revisão.
- Após pesquisar, o script tenta abrir novo preview **5006**, sem interromper 5005, e a ficha inclui `Ver resultado da IA real`. O ambiente de preview roda com pesquisas pagas desativadas e sem variáveis de chave de API.
- **PENDENTE:** execução real, avaliação do acesso via Tavily (403 no Node direto não prova bloqueio na Tavily), revisão de qualidade das fontes e custo efetivo; se falhar, não promover a pesquisa em escala. A implementação por GitHub não significa execução/homologação.

## Atualização — Missão 11.4: fontes técnicas reais V2
- Código publicado, **ainda não executado/homologado no Codespaces**. Roteiro `scripts/mission11-4-run-v2-once.sh`, branch `feat/uppulse-missao10-supercatalogo`.
- Duas pesquisas Tavily de até 10 candidatos cada, três extrações OpenAI no máximo, unicamente para Adidas Adizero Evo SL, com bloqueio de repetição e tests/TypeScript antes de cobrar.
- Exclui YouTube e site institucional da Tavily, prioriza evidência técnica, exige modelo e marca no trecho, não duplica adidas.com/adidas.com.br como fabricantes independentes.
- Relatório separado `/tmp/uppulse-evo-sl-real-research-v2.json`, preview **5007**, botão `Ver IA real — rodada 2`. V1 e previews 5005/5006 preservados. Não alterar PostgreSQL.
- Critério: evidência de dois domínios e pelo menos um campo com concordância verificável. Se não passar, usar resultado para decidir pesquisa mais rica (ex.: extração de conteúdo pelas APIs), **não ativar lote**.


## Missão 11.6 — Ficha narrativa com fontes (2026-11-16)
- Usuário aprovou **síntese curta + citações azuis pequenas por característica + todas as evidências recolhidas na auditoria**, sem votar por maioria nem atribuir correção automática à fabricante.
- Implementação publicada: `server/productIntelligence/customerKnowledge.ts`, `client/src/components/IntelligentProductCard.tsx`; ligada a `ProductKnowledge.tsx` e ao relatório real do Evo SL V2 em `EvoSlPilot.tsx`. `reportReconciliation.ts` preserva tipos das fontes. Sem APIs pagas, sem escrita no catálogo.
- Testes adicionados em `customerKnowledge.test.ts` e `tests/e2e/ai/consultor-ficha.spec.ts`. **Ainda aguardam execução no Codespaces.**
- Comando único: `git fetch origin feat/uppulse-missao10-supercatalogo && git show origin/feat/uppulse-missao10-supercatalogo:scripts/mission11-6-intelligent-card-preview.sh | bash` a partir de `/workspaces/uppulse-homologacao/missao9/codigo`. Valida tipos/testes, inicia porta **5009**, executa Playwright e deixa botão `Ver IA real — rodada 2` para inspeção.
- A ficha atual produz síntese **determinística** de evidências auditáveis, não texto gerado novamente por LLM; futura evolução poderá sintetizar por OpenAI com verificação de claims, sem esconder fonte única/conflitos. Alinhar `masterId` operacional com Master confirmado antes da publicação em escala.


## Missão 11.7 — Ficha em página inteira, tradução pt-BR e unidades métricas
- Mudanças publicadas; **validação pendente no Codespaces**. Abrir `Características do produto · Ficha inteligente` agora ocupa `100dvh x 100vw`, com conteúdo largo e rolagem.
- A apresentação V2 do Evo SL aparece antes dos diagnósticos. Tradução determinística dos trechos do relatório V2, com drop/alturas em milímetros, pesos em gramas e numeração dos calçados explicitamente marcada como US. Originais e fontes continuam acessíveis na auditoria; dados comerciais intocados.
- Testes adicionados em `server/productIntelligence/technicalPresentation.test.ts`; Playwright existente verifica tela cheia, entressola traduzida e peso em gramas.
- Preview novo e isolado na porta **5010**, sem chamadas externas: `cd /workspaces/uppulse-homologacao/missao9/codigo && git fetch origin feat/uppulse-missao10-supercatalogo && git show origin/feat/uppulse-missao10-supercatalogo:scripts/mission11-7-ficha-fullscreen-ptbr.sh | bash`.
- Não usar a porta antiga 5009 para verificar o novo código. No sucesso, esperar `FICHA_TELA_CHEIA_PTBR_OK`.
- Tradução coberta para as expressões já coletadas; **não é tradução universal de texto futuro**. Não pesquisar novos produtos antes da aprovação visual.


## Ponte ChatGPT → GitHub → Codespaces (fase 1, 2026-11-17)
- Implementada **no GitHub**, ainda aguardando instalação inicial e validação no Codespaces: `scripts/uppulse_codespace_agent.py`, `scripts/uppulse_bridge_install.sh`, testes e workflow de segurança. Relatório: `docs/relatorios/UPPULSE_PONTE_GITHUB_CODESPACES_FASE1.md`.
- Issue de diagnóstico inicial criada: https://github.com/edineilemes-source/beupfree/issues/20 (título `[UPPULSE-AGENT] STATUS`). Será processada apenas após o agente estar ativo no Codespaces.
- Comando único para bootstrap: `cd /workspaces/uppulse-homologacao/missao9/codigo && git fetch origin feat/uppulse-missao10-supercatalogo && git show origin/feat/uppulse-missao10-supercatalogo:scripts/uppulse_bridge_install.sh | bash`.
- Agent V1: STATUS / VALIDAR / PREVIEW (portas 5011–5015) / PARAR PREVIEW. Não aplica patches locais nem inicia Codespace desligado. Persistência após rebuild ainda não configurada.
- **Ficha Inteligente permanece congelada**, inclusive Mission 11.7 pendente de validação. Não executar novas pesquisas Tavily/OpenAI.

## Revisão do coordenador e fonte única (2026-11-17)
- Protocolo obrigatório: `docs/PROTOCOLO_GITHUB_CODESPACES_FONTE_UNICA.md` (GitHub remoto canônico; Codespaces apenas executor de snapshot por SHA). `AGENTS.md` atualizado.
- Doctor de dependências: `scripts/uppulse_bridge_doctor.py`; instalador `scripts/uppulse_bridge_install.sh` chama o Doctor. Requisitos Python 3.9+, Node 22+ (preferência Node 24 LTS testada), GH CLI, git, npm, tar, curl, ss; Docker para preview. `gh codespace` e Codex CLI não são requisitos da ponte em execução.
- Perfis do agente: basic, unit, build, ui. Estado persistente em `.git/uppulse-bridge`; autostart após rebuild ainda **não** preparado porque falta confirmar configuração real do devcontainer.
- **Não declarar agente funcionando antes de receber resposta da Issue #20**, nem considerar resolução de persistência. Consulta/instalação manual inicial pendente.


## Plataforma operacional e lançamento UpPulse — execução de 2026-11-17
- **CÓDIGO oficial = GitHub remoto**, Codespaces só executor de commits em snapshots isolados; regra `docs/PROTOCOLO_GITHUB_CODESPACES_FONTE_UNICA.md`.
- Ponte comprovada: Issue #20 STATUS respondeu e fechou; Issue #21 testes básicos passaram no SHA cda8173c. Falhas reais: Issue #22 PREVIEW 5011 (BLOCKED), Issue #23 validação build (BLOCKED) sem causa específica no agente V1.
- Corrigidos no GitHub: diagnóstico seguro de falhas, ações DIAGNOSTICO e CATALOGO read-only, script de recuperação do agente ao abrir terminal (`scripts/uppulse_bridge_ensure.sh`), upgrade idempotente do instalador, CI `.github/workflows/uppulse-release-gate.yml`. Essas melhorias **não foram ativadas no Codespaces ainda**, pois versão anterior do agente continua na memória; requer uma atualização de instalador executada pelo operador, uma única vez.
- Etapa após atualizar agente: ChatGPT aciona DIAGNOSTICO + CATALOGO, resolve bloqueio concreto de PREVIEW/BUILD, homologa porta e gate de release. Não declarar servidor no ar antes de HTTP verificado. Reinício após abertura de terminal tem hook preparado, reconstrução completa do devcontainer segue não homologada.
- Relatório detalhado: `docs/relatorios/UPPULSE_PREPARACAO_LANCAMENTO_2026-11-17.md`. Banco histórico `uppulse_catalog` não é base pública de produção. Publicação Hostinger pendente de acesso/ambiente autorizados e validação de dados/compras; nenhuma publicação ou migração executada.
- **Ficha Inteligente segue congelada; sem novas pesquisas IA pagas.**

 
## Continuidade de prioridade — Olympikus (2026-11-17)
- Verificar pela rota `/api/admin/awin-feeds/merchant/17698/audit` ou pelo painel Curadoria → Feeds os números **por anunciante** no banco `uppulse_catalog`.
- Diagnosticar ausência/cobertura da Master e da classificação/preço/projeção. A importação de 5.167 ofertas **em staging** não equivale a publicação. Não criar filtro fixo com produtos ainda não elegíveis.
- Se a etapa de preço regular depender da migração 0014, confirmar backup/teste de restauração e autorização antes de tocar no esquema. Não executar API paga nem credenciar provisoriamente produtos sem validação.
- Relatório: `docs/relatorios/MISSAO11_OLYMPIKUS_PRODUTO_MASTER_E_LOJA_2026-11-17.md`.

 
## Curadoria V3 — prioridade de implementação (2026-11-18)
- Etapa 1 codificada e validada no CI: contrato `server/curationSources/masterPipeline.ts` e bridge `masterParserPreview.ts` usam **bibliotecas históricas**; interface integrada à Curadoria e sem novas fusões.
- Validar preview da branch canônica e endpoint `/api/admin/awin-feeds/merchant/17698/master-preview`.
- Próxima etapa: orquestrador persistente de novas lojas/feeds e worker que use `productIdentity/jobs.ts`, `operational.ts`, `catalogPersistence.ts` e projeção existente, SEM duplicar regras, SEM disparar mudanças no banco antes do gate e SEM publicar itens sem desconto comprovado.
- Relatório: `docs/relatorios/CURADORIA_V3_ETAPA1_PRESERVACAO_MASTER_2026-11-18.md`.

 
## Bloqueio operacional comprovado — Curadoria V3, 2026-11-18
- GitHub Actions validou etapa 1 (SHA `d08f2f966956ecacf415b42acd2fb5da83e3dc16`).
- Issue #56 tentou preview 5012 da versão com documentação; retornou `CATALOG_DATABASE_NOT_UNIQUELY_VERIFIED`.
- Diagnóstico read-only issue #57 confirmou `catalog_db_container=exited`: o contêiner existente `beupfree-catalog-pg17` está parado. Nenhuma intervenção foi feita no volume.
- Para homologar visualmente e consultar Master, iniciar **somente contêiner existente**, reconfirmar DB canônico e repetir `PREVIEW` de SHA remoto, sem reset/rebuild/migração. Não declarar homologado antes da confirmação.

 
## Prioridade — Curadoria V3 automática (2026-11-23)
- Implementados a análise de identidade automática por registro durante upload, relatório de ambiguidades paginado, relatório de rejeições original preservado e sua apresentação na UI. Não há acionamento de IA externa por produto.
- CI oficial agora inclui testes criados para Curadoria V3 no `test:unit`. Verificar release gate da branch a partir do commit `bb8fb55ad9ac781922ed24c79a346de50ac5fc83`.
- Implementar próximo: jobs persistentes e idempotentes por merchant/feed e estado do pipeline; worker histórico de Produto Mestre em escopo seguro; normalização/evidências; projeção pública após validação e atualização periódica de feeds. Não executar migração ou publicação prematura.
- Codespaces: issues #58/#59 ainda exigem resposta do agente; restabelecer DB preservando volume.
- Relatório: `docs/relatorios/CURADORIA_V3_TRIAGEM_AUTOMATICA_2026-11-23.md`.

 
## Próxima ação — Curadoria V3 e teste nas portas Codespaces (2026-11-23)
- Concluir ponte Codespaces e recuperar de forma não destrutiva o contêiner `beupfree-catalog-pg17` caso ainda esteja em falha; não recriar volumes.
- Validar commit imutável da etapa `bfa0ecc57e573458cdbf40dc373e2de06c1cf140` no agente restrito (GitHub Issues); executar preview 5011–5015 somente após banco verificado.
- Revisar/obter autorização de migração do journal; não executá-la nesta sessão; não ativar handlers que alteram `offers`, `product_master_memberships` ou `catalog_search_products` antes de preflight e testes.
- Continuar implementação dos adaptadores reais existentes e agendador de atualização para fechar o ciclo upload → Master → validação → loja.
- Documentação `docs/relatorios/CURADORIA_V3_WORKFLOW_PERSISTENTE_2026-11-23.md`.

 
## Próximo passo prioritário (2026-11-23) — validar Curadoria V3 no Codespaces
- Release Gate SUCCESS `45280828634`, commit `061ccd973555263f2fe75f688c143f8cc9819c9d`. Testar no Codespaces snapshot de SHA remoto com versão documental atual, sem mexer no checkout.
- Endpoint de simulação `/api/admin/awin-feeds/merchant/17698/master-shadow?limit=100` e botão Curadoria → Feeds: testar depois de restaurar banco.
- Issues de ponte #58/#59/#61/#62 abertas sem resposta na última inspeção. Código GitHub funciona, terminal Codespaces não acessível; não alegar preview no ar.
- Prosseguir com integração de handlers reais em ambiente de homologação após banco verificado e migração do journal autorizada com backup; não publicar automaticamente sem gates comerciais por oferta.
- Relatório `docs/relatorios/CURADORIA_V3_COMPARACAO_MASTER_EM_TELA_2026-11-23.md`.

## Próxima ação — Olympikus 0% (24/11/2026)
- Regra de negócio reafirmada: 0% de desconto e preço atual igual ao anterior de compatibilidade representam preço regular sem promoção; permitir comparação e indexação quando elegível.
- Código no GitHub preparado: `scripts/olympikus_regular_clone_release.py` executa backup/restauração integral antes da migração `0014` e está limitado ao clone verificado. Reinstalar agente a partir do GitHub e executar release com flag explícita somente no Codespaces, sem Hostinger. A publicação ainda não ocorreu.
- Verificar a Issue #93 e testar o catálogo/merchant facets após execução; preservar ofertas regulares sem inventar desconto. Referência: `docs/relatorios/MISSAO10_OLYMPIKUS_PRECO_REGULAR_20261124.md`.

## Entrada de parceiros AWIN multiempresa — 25/11/2026
- Integração genérica publicada no GitHub com `scripts/awin-partner-onboard.py`, `scripts/awin-partner-master.ts`, `scripts/awin-partner-versions.ts`, ponte GitHub com ação autenticada `INTEGRAR_AWIN` e testes. Relatório: `docs/relatorios/MISSAO10_PIPELINE_GENERIC_AWIN_20261125.md`.
- O usuário faz upload e Processar aceitos na Curadoria; após staging, criar Issue de proprietário `[UPPULSE-AGENT] INTEGRAR_AWIN` com corpo `{"merchant":"ID_AWIN","feedId":"ID_FEED"}`; o restante do ciclo usa verificação, backup/restauração, Master histórico, preço regular 0%, classificação, normalização e projeção no clone auditado. Não executar na produção.
- É preciso atualizar a ponte do Codespaces UMA vez para versão 1.3.6. A integração de um segundo fornecedor ainda precisa ser homologada com dados reais e testes completos; não declarar produção.
- Recusar refresh de lojista já processado sem fluxo incremental; não executar reimportação/migração às cegas.
