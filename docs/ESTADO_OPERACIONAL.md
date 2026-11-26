# UpPulse — estado operacional canônico (Missão 10.1)
Atualizado: 2026-11-10. **Este documento substitui referências operacionais antigas em .ai/PROJECT_STATE.md; nunca substitui evidências reais.**

## Regra de retomada
Antes de propor execução: ler `AGENTS.md`, este arquivo, `.ai/PROJECT_STATE.md`, `.ai/NEXT_ACTION.md`, `docs/missao10-postgres.md`, os arquivos do módulo afetado e o histórico Git da branch. Se houver divergência, conferir por consultas read-only e registrar a correção. Não adivinhar host, porta, branch, estado de migração ou homologação.

## Código e ambiente
- Repositório: `edineilemes-source/beupfree`; branch da Missão 10: `feat/uppulse-missao10-supercatalogo`. Pasta de trabalho observada: `/workspaces/uppulse-homologacao/missao9/codigo`. A nomenclatura da pasta não define a missão ativa.
- As referências antigas a `codespace-working`, `/workspaces/beupfree` e a missões de setembro são **históricas**; não tratá-las como estado operacional atual sem confirmação.
- Stack: React/TS/Vite, Express/TS, Drizzle, PostgreSQL. Domínio multi-marketplace: Produto ≠ Oferta.
- Verificar branch e commit efetivos com `git branch --show-current && git rev-parse --short HEAD && git status --short`. Não fazer reset, merge, push forçado ou deploy.
- Testes já informados pelo operador: `npm run check` e `npm run test:mission10` passaram (14 testes) antes desta consolidação. Não afirmar execução de testes novos sem evidência.

## Banco de dados — CONFIRMADO em 2026-11-10 por SQL read-only
- Contêiner Docker: `beupfree-catalog-pg17`; imagem `postgres:17-alpine`; porta do host `127.0.0.1:5435` → 5432 no contêiner.
- Banco: `uppulse_catalog`; volume persistente `beupfree-catalog-pg17-data`.
- Contagens exatas: `public.products=32707`, `public.offers=96851`, `public.catalog_search_products=16945`; tamanho observado ~1112 MB.
- `products.id` é varchar; validar conteúdo e restrições reais antes de aplicar FK/migração. `product_intelligence_cache` **foi criada com sucesso em 2026-11-10**, por migração aditiva autorizada, com 0 linhas iniciais; índices `product_intelligence_cache_pkey`, `idx_m10_cache_master`, `idx_m10_cache_expiration`. Confirmado por SQL após COMMIT.
- `beupfree-recovery-postgres` (5434) estava ativo mas seu banco `postgres` não tinha tabelas de usuário; não é a referência do catálogo. Instâncias históricas `beupfree-postgres` (5433) e bases das Missões 7/8 não são fontes de verdade.
- Se o Codespace reiniciar, o contêiner 5435 pode estar parado. Inspecionar `docker ps -a` e o volume antes de iniciar **o contêiner existente**; jamais recriar/remover volumes.
- Credenciais **não** ficam no Git. O terminal da Missão 10 não tinha `DATABASE_URL`; não copiar `.env` antigo nem usar senha da Missão 8. Para leitura no contêiner, usar `docker exec -i beupfree-catalog-pg17 sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -X -v ON_ERROR_STOP=1'`.
- Backup pré-migração: **arquivo de 109 MB confirmado e índice legível por pg_restore -l em 2026-11-10; restauração completa ainda não testada**. A PK de products.id foi confirmada e o maior ID mede 36 caracteres (nenhum acima de 36). Relatório: docs/relatorios/MISSAO10_2_PREFLIGHT_2026-11-10.md. Não rodar `db:push`, migrações ou testes mutáveis antes de verificar backup e autorização.

## Produto e catálogo
- Missão 9 consolidou código/banco e o operador relatou agrupamentos reais funcionando na interface antes do recesso. Esse funcionamento é **relato histórico**, não homologação reproduzida nesta sessão.
- Catálogo de 16945 registros da projeção inclui elegíveis Dafiti/FutFanatics; Mercado Livre DEMO não deve ser confundido com catálogo operacional.
- Preservar Product Identity Master, variantes, ofertas, filtros, organizador e UX existentes. Confirmar layout aprovado pelos arquivos e screenshots do projeto antes de alterar.

## Missão 10 — inteligência de produtos
- Implementado: `server/productIntelligence/superCatalog.ts` (identidade, SuperHash e conflitos), `research.ts` (orquestração), `liveProvider.ts` (Tavily/OpenAI), `fileCache.ts` (cache persistente local), `postgresCache.ts` (adaptador SQL), testes relacionados e migração aditiva `migrations/mission10_product_intelligence_cache.sql`.
- Smoke real já informado: Adidas Adizero Adios Pro 4, resultado ENRICHED; segunda execução reutilizou cache local, sem novas chamadas pagas. Resultados de evidências podem divergir; não fundir Master IDs automaticamente.
- `scripts/mission10-first-research.ts` usa **cache em arquivo** e identidade piloto; NÃO está integrado ao PostgreSQL. Adaptador PG testado com executor simulado, não contra banco real. A migração foi aplicada em 2026-11-10; o adaptador PostgreSQL ainda não foi homologado com escrita/leitura real.
- Credenciais de API somente em ambiente seguro. Custos, limites, concorrência e TTL ainda exigem controle antes de pesquisa em escala. Não disparar pesquisa paga automaticamente.
- Documentos: `docs/missao10-research.md` e `docs/missao10-postgres.md`.

## Infraestrutura e publicação
- Codespaces + Docker local para homologação; Hostinger/produção e gates de publicação **não autorizados** por esta missão.
- Portas e volumes são fatos ambientais sujeitos a reinicialização; reconfirmar sem vasculhar bancos históricos indiscriminadamente.
- Não publicar segredos, dumps, relatórios contendo URLs com credenciais ou dados pessoais.

## Próxima ação e critérios de encerramento
1. Preservar este estado no GitHub e manter `.ai/` sincronizado; relatório da Missão 10.1 em `docs/relatorios/`.
2. Backup de 109 MB com índice legível; restauração completa não testada. Migração aditiva já executada e validada.
3. Homologar adaptador PG com produto Master real e dados sintéticos, sem API paga; limpar somente registros de teste mediante plano seguro.
4. Concluir integração de IA com orçamento, cache, evidências e UI testados; não chamar de concluída antes disso.

## Contrato permanente de continuidade
- Cada missão deve atualizar: branch/commit, alterações, testes **realmente** executados, versão do esquema, instância/banco/porta, contagens de referência quando verificadas, infraestrutura, layout, APIs/custos, decisões, riscos e próximo passo.
- Separar **CONFIRMADO**, **RELATADO**, **IMPLEMENTADO MAS NÃO HOMOLOGADO** e **PENDENTE**. Usar data e evidência; nunca transformar intenção em fato.
- Relatório versionado no GitHub, não exigir que o usuário copie logs para o chat. Em falha de validação, registrar bloqueio e não declarar missão concluída.


## Atualização — Missão 10.5, 2026-11-10 (posterior ao estado acima)
- **HOMOLOGADO no terminal normal do Codespaces:** `node --import tsx scripts/mission10-postgres-integration.ts` retornou `MISSÃO 10.5: integração PostgreSQL aprovada e registro sintético ausente após ROLLBACK`, com `DATABASE_URL` temporária apontando para o banco existente `uppulse_catalog` em `127.0.0.1:5435`. A evidência é o resultado fornecido pelo operador; o teste foi preparado para usar IDs reais e dados sintéticos sob transação.
- **IMPLEMENTADO LOCALMENTE, NÃO VERSIONADO:** `server/productIntelligence/postgresResearch.ts`, alterações em `postgresCache.ts` e `postgresCache.test.ts`, e `scripts/mission10-postgres-integration.ts`. O piloto em arquivo permanece. O código não foi publicado; não interpretar a publicação desta documentação como deploy ou integração ativa em produção.
- **TESTES DO CODEX:** `npm run check`, `npm run test:mission10` e testes direcionados do adaptador passaram; conexão TCP falhou apenas no sandbox. A homologação PostgreSQL ocorreu posteriormente no terminal normal.
- **PENDENTE:** revisão e autorização para commit/push do código, integração ao consumidor de aplicação/UI, controle de custos/concorrência e gates gerais. Não foram reconferidas contagens comerciais nesta etapa.
- Relatório: [Missão 10.5](relatorios/MISSAO10_5_INTEGRACAO.md). As afirmações anteriores de que o adaptador PostgreSQL não foi homologado representam o estado *anterior* a esta atualização.


## Atualização posterior — Missão 10.5 publicada, 2026-11-10

**PUBLICADO:** o código da Missão 10.5 foi revisado pelo Codex, considerado apto para publicação e enviado à branch `feat/uppulse-missao10-supercatalogo` no commit `8afe2dd`. Foram versionados exatamente quatro arquivos: `server/productIntelligence/postgresCache.ts`, `server/productIntelligence/postgresCache.test.ts`, `server/productIntelligence/postgresResearch.ts` e `scripts/mission10-postgres-integration.ts`. O resultado de push foi confirmado pelo operador. A homologação PostgreSQL transacional foi aprovada **antes** dos últimos ajustes de segurança do script; estes passaram nos testes de código, mas não foram reexecutados no banco real após os ajustes. As frases anteriores 'não versionado' são histórico superado. Não houve deploy nem ativação de pesquisas pagas. **Próxima missão: 10.6**, concorrência e limites de custos. Seguir o contrato de publicação documental em `AGENTS.md`.

## Atualização — Missão 10.6, 2026-11-10

- **IMPLEMENTADO E TESTADO LOCALMENTE:** deduplicação por SuperHash no processo, reserva compartilhada de execução para o serviço PostgreSQL e reserva de orçamento estimado antes de cada chamada Tavily/OpenAI. O checkout de código está em `8afe2dd`. A base documental remota consultada é `d698d23`.
- **PENDENTE DE HOMOLOGAÇÃO:** coordenação e orçamento em PostgreSQL real dependem da proposta aditiva local `migrations/mission10_research_coordination.sql`. A migração não foi aplicada. Manter `RESEARCH_PAID_ENABLED` e `RESEARCH_POSTGRES_HOMOLOGATED` desabilitados. Nenhum acesso a banco, alteração comercial ou chamada paga nesta execução.
- **Verificações:** TypeScript e testes Mission 10 passaram com provedores e armazenamento simulados. A evidência transacional da Missão 10.5 continua sendo a referência do cache instalado.
- [Relatório da Missão 10.6](relatorios/MISSAO10_6_CONCORRENCIA_CUSTOS.md).

**Publicação desta execução:** RELATÓRIO NÃO PUBLICADO. Consulte o comando de publicação documental no relatório.

## Confirmação remota — código da Missão 10.6 publicado (2026-11-10)

- **PUBLICADO NO GITHUB:** dez arquivos de implementação, testes e proposta de migração da Missão 10.6 foram confirmados por comparação entre `f25889c` e a branch remota `feat/uppulse-missao10-supercatalogo`: um commit adicional, dez arquivos alterados, sem divergência de histórico. A indicação anterior de que o código estava somente no Codespaces está superada.
- **NÃO HOMOLOGADO:** a publicação do arquivo `migrations/mission10_research_coordination.sql` não significa que ele foi aplicado ao PostgreSQL. Permanecem pendentes autorização de migração, confirmação de backup atual, testes com duas conexões PostgreSQL reais e validação de recuperação de reservas órfãs após falha abrupta.
- **NÃO EXECUTADO NESTA VERIFICAÇÃO:** TypeScript, testes automatizados, build, acesso ao banco, chamadas pagas e deploy. A conferência foi de conteúdo e histórico GitHub.
- **PRIORIDADE:** concluir a Missão 10.6 antes de iniciar a Missão 11. Não repetir transferência de arquivos já versionados.

## Homologação PostgreSQL Missão 10.6 — confirmada em 2026-11-10
- Operador executou migração aditiva autorizada em `uppulse_catalog`, contêiner `beupfree-catalog-pg17`, PostgreSQL 17.11: `research_claims` e `research_budget` criadas em transação com COMMIT.
- Contagens antes e depois: 32.707 produtos, 96.851 ofertas, 16.945 projeções; nenhuma alteração nas contagens.
- Backup `/workspaces/backups/uppulse_catalog_pre_missao10.dump` (114.180.296 bytes) com índice e entradas TABLE DATA conferidas pelo pg_restore 17; restauração integral não comprovada.
- Testes do GitHub Actions reportados aprovados: TypeScript, testes Missão 10 e concorrência/orçamento em PostgreSQL efêmero. Execução real no Codespaces do script `scripts/mission10-6-homologate.sh`: `M10_6_HOMOLOGATION_SQL_ROLLBACK_OK` e `M10_6_HOMOLOGATION_COMPLETE`, zero linhas remanescentes em ambas as tabelas de controle. Esse script verifica regras SQL transacionais, não simula dois processos no banco de homologação.
- Pesquisas pagas seguem desativadas. Reserva órfã após falha abrupta ainda exige recuperação operacional segura; não declarar ativação de IA paga autorizada.
- Checkout local continua divergente (1 commit exclusivo local, 29 remotos na verificação anterior), com alterações locais; não executar pull/rebase/reset destrutivos.
- **Próxima prioridade: Missão 11**, iniciar aplicação e validar catálogo e UX com dados reais. Não bloquear o catálogo por ativação de IA paga.


## Missão 11.1 — validação executada no Codespaces (2026-11-12)
- Operador executou `scripts/mission11-1-real-preview-test.sh` com código remoto no commit `d385a98` em snapshot isolado `/tmp/uppulse-m11-ai-AeHhG5` e porta `5002`. A execução reportou `M11_1_REAL_CATALOG_AND_PLAYWRIGHT_OK`.
- Banco PostgreSQL existente estava acessível. GET `/api/products?limit=2` retornou `catalogSource: operational`, dois produtos e `total: 16945`. Produto utilizado na checagem: `02474478-a62e-40c8-8459-dd4deb47d5a0`.
- GET `/api/product-knowledge/<productId>` retornou `IDENTITY_ONLY`, Master ID correspondente e SuperHash `9f8964b20d0392db98f1c2e0b51860d200d0e9b099a1ad460d7e463f258e6299`. Isso confirma identidade calculada, **não** pesquisa/enriquecimento externos.
- Playwright no navegador real, com fixtures simuladas: **3 testes aprovados em 18,6 s**: filtros/recomendação/link, bloqueio de DEMO e ficha inteligente/SuperHash. Não confundir estes testes UI simulados com navegação completa no catálogo real.
- Não houve migração nem chamada paga; checkout local divergente preservado. Preview na aba PORTS → `5002` → Open in Browser.
- Próximo gate: conferir manualmente a experiência no preview com produtos reais, validar filtros e fluxo de oferta; auditar configuração de runtime e registrar eventuais erros. Pesquisa externa paga permanece desativada.


## Missão 11.1 — melhoria de busca e diagnóstico (2026-11-12)
- Após constatação do operador de resultados repetidos, o consultor foi atualizado para distinguir **nova busca** de **refinamento por preço/tamanho**, limpar filtros antigos em novas pesquisas e não reutilizar resultados em mensagens não compreendidas.
- A interface agora exibe filtros ativos e **total informado pelo backend operacional** (até seis ofertas exibidas); mostra aviso para modalidade trilha ainda sem filtro específico; botão `Nova pesquisa` reinicializa o estado.
- Testes unitários adicionais cobrem troca de marca, preservação intencional de filtros, perguntas não reconhecidas e modalidade sem filtro. Playwright adicional cobre mudança de consulta, contagens, bloqueio da repetição e limpeza de estado.
- Script de homologação `scripts/mission11-1-real-preview-test.sh` foi atualizado para usar a **porta 5003** e realizar consultas distintas diretamente ao banco de homologação, preservando os previews anteriores nas portas 5000/5002.
- **PENDENTE:** execução dessa nova versão do script e confirmação dos novos testes; não declarar aprovação antes da saída do terminal. IA externa paga continua desabilitada e a IA interna continua baseada em regras/filtros, não em LLM.


## Missão 11.1.3 — investigação do screenshot e integração de atributos técnicos (2026-11-12)
- O screenshot fornecido pelo operador continha a frase `Encontrei 6 opções para você avaliar`, presente **apenas no componente antigo**, e não exibia `Filtros realmente aplicados` ou `assistant-version`. Evidência de que estava visualizando uma instância antiga (provavelmente porta 5002), não a revisão 11.1.2. Não atribuir automaticamente esta captura à versão corrigida.
- A revisão v11.1.3 identifica a versão no título, reinicializa texto e filtros quando a janela é fechada/aberta e evita carregar a antiga pesquisa da barra do cabeçalho. Nova consulta reconhecida limpa preço/tamanho não mencionados; refinamentos explícitos podem conservar filtros.
- Busca técnica agora encaminha `tecnica` para endpoint read-only `GET /api/assistant/technical/search`. Ele cruza `product_intelligence_cache` com `catalog_search_products`, `commerce_merchants` e `offers`, aplica critérios de catálogo operacional, exige status `ENRICHED` e campos `VERIFIED` ou `SINGLE_SOURCE`, retorna no máximo 6 ofertas e identifica claramente evidências de fonte única. Não consulta Tavily/OpenAI.
- Reconhece amortecimento, maciez, conforto, cabedal, drop, solado e material com correspondência **literal e limitada**. Ausência de evidências armazenadas retorna zero resultados, sem alegar que o produto não possui a característica. Ainda não é mecanismo semântico/LLM nem pesquisa integral sobre produtos não enriquecidos. Dados técnicos não são inventados.
- Testes unitários e Playwright novos incluem reprodução exata de `quero um tenis nike de corrida` após busca de Adidas com R$500/tamanho 41, busca técnica cache-only, ausência de conhecimento e reinicialização da janela. O script de homologação usa preview isolado porta **5004** e smoke SQL/HTTP de filtros comerciais e de evidências reais. **Aguardando execução nova no Codespaces; não declarar aprovação desta revisão**. Mantidas chamadas pagas desabilitadas, sem migração e sem alterar checkout local divergente.


## Piloto 11.2 — Evo SL (2026-11-16)
- O laboratório de enriquecimento da ficha foi implementado na branch remota: botão `Testar ficha Evo SL — 3 fontes` no painel existente, visível apenas em desenvolvimento. Endpoint `/api/product-knowledge/pilot/evo-sl` desativado em produção.
- Três fontes públicas reais (adidas Brasil KJ1363, Centauro masculino, Netshoes masculino) deram origem a um **conjunto pré-extraído de evidências**, que é processado pelo orquestrador `enrichProduct` com provedor simulado. Mostra síntese, atributos, URLs, concordância e conflito. Não coleta automaticamente páginas, não faz inferência LLM ao clicar, não grava no PostgreSQL nem chama APIs pagas.
- O script `scripts/mission11-2-evo-sl-pilot.sh` prepara snapshot isolado, executa TypeScript, unitário e Playwright, verifica endpoint e realiza um único GET de teste por fonte para medir acessibilidade HTTP; preview porta 5005, preservando 5000–5004. **Execução e homologação pendentes** da saída do Codespaces. Relatório `docs/relatorios/MISSAO11_2_PILOTO_FICHA_EVO_SL.md`.
- Próximo gate após testes: protótipo de extração automática limitado a um único Master confirmado e três fontes, sob autorização explícita se houver APIs pagas; critérios de identidade, fontes, conflitos, custo e persistência.


## Integração operacional Codespaces via GitHub Issues — 2026-11-17
Foi publicado um agente restrito e um instalador para o Codespace de homologação, no repositório e branch indicados em AGENTS.md; **não foram instalados no Codespaces nesta etapa**. O agente cria snapshots isolados para validação e preview, usa somente portas 5011–5015, sem tocar servidores antigos nem banco de dados por alterações administrativas. A primeira tarefa de status é a Issue #20 no GitHub, aguardando instalação. A recuperação automática após Codespace reiniciado/reconstruído ainda precisa ser homologada, sem presumir devcontainer ativo. Relatório: `docs/relatorios/UPPULSE_PONTE_GITHUB_CODESPACES_FASE1.md`.


## Padronização GitHub ↔ Codespaces — 2026-11-17
**CÓDIGO CANÔNICO = commit na branch do GitHub. CODESPACES = EXECUTOR em snapshot isolado por SHA.**
- Regra principal em `docs/PROTOCOLO_GITHUB_CODESPACES_FONTE_UNICA.md`, registrada também em `AGENTS.md`. Diferenças entre SHA local e remoto são esperadas; não executar pull/reset automático.
- Publicação de código autorizada pelo conector GitHub, com revisão por missão. A homologação do Codespaces não altera checkout nem aplica patch. Logs e resultados são ligados ao SHA, devolvidos por GitHub Issues.
- Implementado no GitHub mas **não instalado/validado no Codespaces**: agente `scripts/uppulse_codespace_agent.py`, Doctor `scripts/uppulse_bridge_doctor.py`, instalador `scripts/uppulse_bridge_install.sh`, teste de contrato e GitHub Actions. Estado local do agente guardado em `.git/uppulse-bridge`; inicialização automática após rebuild pendente do devcontainer efetivo.
- GitHub Issue #20 aguarda resposta real do agente. Portas exclusivas da ponte 5011–5015; não modificar serviços antigos.
- Node recomendado 24 LTS após avaliação de compatibilidade, Node 22+ aceito no primeiro preflight; Node 20 EOL. `gh codespace` e Codex CLI não são dependências para consumir a fila de Issues já dentro do Codespaces.
- **Enriquecimento da Ficha Inteligente segue congelado**, sem novas pesquisas pagas ou divulgação comercial.


## Plataforma operacional e lançamento UpPulse — execução de 2026-11-17
- **CÓDIGO oficial = GitHub remoto**, Codespaces só executor de commits em snapshots isolados; regra `docs/PROTOCOLO_GITHUB_CODESPACES_FONTE_UNICA.md`.
- Ponte comprovada: Issue #20 STATUS respondeu e fechou; Issue #21 testes básicos passaram no SHA cda8173c. Falhas reais: Issue #22 PREVIEW 5011 (BLOCKED), Issue #23 validação build (BLOCKED) sem causa específica no agente V1.
- Corrigidos no GitHub: diagnóstico seguro de falhas, ações DIAGNOSTICO e CATALOGO read-only, script de recuperação do agente ao abrir terminal (`scripts/uppulse_bridge_ensure.sh`), upgrade idempotente do instalador, CI `.github/workflows/uppulse-release-gate.yml`. Essas melhorias **não foram ativadas no Codespaces ainda**, pois versão anterior do agente continua na memória; requer uma atualização de instalador executada pelo operador, uma única vez.
- Etapa após atualizar agente: ChatGPT aciona DIAGNOSTICO + CATALOGO, resolve bloqueio concreto de PREVIEW/BUILD, homologa porta e gate de release. Não declarar servidor no ar antes de HTTP verificado. Reinício após abertura de terminal tem hook preparado, reconstrução completa do devcontainer segue não homologada.
- Relatório detalhado: `docs/relatorios/UPPULSE_PREPARACAO_LANCAMENTO_2026-11-17.md`. Banco histórico `uppulse_catalog` não é base pública de produção. Publicação Hostinger pendente de acesso/ambiente autorizados e validação de dados/compras; nenhuma publicação ou migração executada.
- **Ficha Inteligente segue congelada; sem novas pesquisas IA pagas.**

 
## Auditoria Olympikus / Loja — 2026-11-17
- GitHub Issue #54: confirmação read-only dos totais do contêiner `beupfree-catalog-pg17` após recebimento do feed AWIN 17698/51837: 33.520 produtos, 102.018 ofertas e 16.945 projeções. Baseline: 32.707/96.851/16.945. **A diferença de 5.167 ofertas não prova vínculo por anunciante nem Produto Mestre**.
- API de auditoria por merchant e painel na Curadoria implementados na branch remota: coberturas de identidade Master, classificações, evidências comerciais, normalizações e projeções; execução real por merchant pendente.
- O filtro Loja lê valores dinamicamente da projeção operacional, não de lista hardcoded. Olympikus só pode aparecer com ofertas realmente elegíveis e projetadas; nenhuma projeção foi criada por esta missão.
- Relatório: [Olympikus / Produto Mestre / Loja](relatorios/MISSAO11_OLYMPIKUS_PRODUTO_MASTER_E_LOJA_2026-11-17.md). Status `PENDING_HOMOLOGATION` dos dados reais; migrações/publicação não executadas.

 
## Curadoria V3 — etapa 1, preservação do Produto Mestre (2026-11-18)
- Regra mandatória: não reescrever nem perder parser V1.5, matcher V1.2, extração do nome/modelo/cor/tamanho, retrieval e agrupamento; bibliotecas originais permanecem intactas. Inventário, testes e artefatos de regressão em `docs/relatorios/CURADORIA_V3_ETAPA1_PRESERVACAO_MASTER_2026-11-18.md`.
- Implementadas ponte do parser histórico e esteira versionada por loja na Curadoria, com consulta read-only por amostragem de 20 identidades; não realiza matching/persistência por conta própria.
- Release Gate do código base `d08f2f966956ecacf415b42acd2fb5da83e3dc16` aprovado (run 44330425674). Ainda exige verificação do preview e dados reais de Olympikus. Não executou migração, publicação nem API paga.
- Próximo gate: orquestrar jobs existentes, classificação, normalização, evidência comercial, publicação, rejeições e atualização agendada, com histórico persistente sem modificar o mecanismo Master.

 
## Curadoria V3 — robô automático de triagem após recebimento (2026-11-23)
- Código canônico da branch reutiliza as regras já homologadas (AWIN normalize/assess, parser de Product Identity V1.5, tamanho/cor e classificação de público). Recebimento do feed gera automaticamente resumo de candidatos e ambiguidades com arquivo versionado; novo endpoint administrativo de paginação e UI para inspecioná-los.
- `package.json` foi atualizado para incluir todos os novos testes de Curadoria V3 no release gate oficial, além dos testes existentes.
- **Ainda não há publicação automática ponta a ponta**: worker persistente de Master, classificações/evidências comerciais, projeção/Loja e rotina de feed remoto ficam pendentes. Não tratar triagem como equivalência/homologação comercial.
- Referência: `docs/relatorios/CURADORIA_V3_TRIAGEM_AUTOMATICA_2026-11-23.md`. Banco de catálogo não alterado por esta etapa.

 
## Curadoria V3 — controle de execução persistente (2026-11-23)
- Implementados e versionados o planejamento read-only por loja e a esteira incremental com checkpoints, tratamento de falhas e idempotência por merchant/feed/sha256; adapter PostgreSQL preparado mas não ligado aos handlers comerciais.
- Migração `migrations/curadoria_v3_workflow_runs_PROPOSTA.sql` é **PROPOSTA NÃO APLICADA**. Sem backup/restauração e autorização não executar.
- GitHub Actions `45279307377` aprovou código SHA `bfa0ecc57e573458cdbf40dc373e2de06c1cf140` (incluindo testes direcionados).
- Banco, tabela Master, ofertas e projeção pública não sofreram escritas nesta etapa. Preview real ainda depende da recuperação do Codespaces/DB.
- Relatório: `docs/relatorios/CURADORIA_V3_WORKFLOW_PERSISTENTE_2026-11-23.md`.

 
## Curadoria V3 — matcher histórico executável via painel (2026-11-23)
- `masterShadowPreview.ts`: botão/UI e endpoint administrativo de simulação comparativa do parser/matcher/retrieval/grouping originais com até 100 identidades do anunciante mais até 100 candidatas de outras lojas; *somente leitura*, não conclui equivalência global nem publica ofertas.
- Testes do novo endpoint HTTP e limites integrados no Release Gate, **SUCCESS** run `45280828634`, commit `061ccd973555263f2fe75f688c143f8cc9819c9d`.
- A migração proposta para journal continua não aplicada; workers comerciais/projeção automáticos ainda não conectados. Preview Codespaces depende de ponte e banco online.
- Relatório `docs/relatorios/CURADORIA_V3_COMPARACAO_MASTER_EM_TELA_2026-11-23.md`.

 
## Recuperação do catálogo e reconhecimento pela ponte (23/11/2026)
- Usuário iniciou cópia do volume original `beupfree-catalog-pg17-data` no volume separado `beupfree-catalog-pg17-restaurado-20261123`, contêiner `beupfree-catalog-pg17-audit`, porta local `5436`, PostgreSQL 17.
- Banco `uppulse_catalog` validado por consultas **reais**: 33.520 produtos, 102.018 ofertas, 16.945 produtos na busca — contagens idênticas ao histórico. Volume original preservado.
- Consulta `information_schema.tables` sob esquema `public` com nomes `product_master%` e `product_identity%` retornou zero. Isto NÃO confirma ausência dos dados Master: consultar `pg_catalog` em todos esquemas e confirmar migrações antes de usar vínculo Master como gate.
- Ponte antes não reconhecia o novo contêiner. Agente v1.3.1 agora admite exclusivamente `beupfree-catalog-pg17-audit` após verificar system identifier `7699654111778938913` e as 3 contagens históricas; busca credencial do contêiner antigo sem registrá-la em log. Não modifica dados.
- Instalador `scripts/uppulse_bridge_install.sh` atualizado para enfileirar preview na porta 5013. **A versão que roda no Codespaces não muda sozinha com o push:** requer executar instalador idempotente no Codespaces. Não alegar preview aberto sem resposta de Issue e HTTP 200.

## Olympikus com preço regular — avanço em 24/11/2026
- Banco recuperado no clone auditado `beupfree-catalog-pg17-audit`: 33.520 produtos, 102.018 ofertas, 16.945 registros de busca; Olympikus AWIN 17698/51837: 813 produtos e 5.167 preços regulares, sem promoção real comprovada. Todos os 813 são elegíveis no dry-run regular, não no fluxo promocional exclusivo.
- Migração `0014_regular_price_offer_evidence.sql` ainda pendente (constraints atuais exigem desconto positivo). Execução controlada com backup/restauração e snapshot remoto preparada, sem aplicação ainda. Status e riscos em `docs/relatorios/MISSAO10_OLYMPIKUS_PRECO_REGULAR_20261124.md`.

## Pipeline AWIN genérico após Olympikus — 25/11/2026
- Regra permanente: `REGULAR_PRICE` com preço anterior de compatibilidade igual ao atual e 0% de desconto é comercialmente elegível se tênis confirmado, com estoque, imagem e link afiliado válido. Não inferir desconto de `base_price` ou parcelas.
- O pipeline de novos parceiros da Curadoria agora tem executor em `scripts/awin-partner-onboard.py`, Produto Mestre histórico em `scripts/awin-partner-master.ts`, versões em `scripts/awin-partner-versions.ts`, testes em `scripts/awin-partner-onboard.test.ts` e ponte `INTEGRAR_AWIN` na versão 1.3.6.
- Processamento automático a partir do staging administrativo, acionado com Issue GitHub autenticada de proprietário. Sem publicação Hostinger, merge cruzado de masters, refresh de lojista existente nem aplicação na base original. Detalhes em `docs/relatorios/MISSAO10_PIPELINE_GENERIC_AWIN_20261125.md`.

## Curadoria 5013 — publicação automática de parceiros (25/11/2026)
- Código implementado na branch de homologação para publicar novos parceiros AWIN **a partir do próprio botão de envio da Curadoria**: upload → triagem → importação em staging → job idempotente → pipeline histórico com backup/restauração verificada → Produto Mestre → preço regular 0% ou promoção comprovada → projeção de busca → confirmação de visibilidade.
- Endpoint `POST /api/admin/awin-feeds/process` passou a iniciar a esteira no clone homologado, sem Issue/SQL manual. Consulta autenticada de progresso: `GET /api/admin/awin-feeds/publication/:merchant/:feedId/:sha256`. A interface distingue QUEUED/RUNNING/COMPLETED/BLOCKED e mantém registros recusados em quarentena.
- O processo funciona no perfil seguro da ponte v1.3.6 já usado na 5013 (ou v1.3.7 atualizada), exclusivamente no clone auditado `127.0.0.1:5436/uppulse_catalog`. Sem alteração em Hostinger, main, base original ou outros fornecedores.
- Clovis AWIN 107702/feed 98680: 2.846 produtos disponibilizados anteriormente via Issue #106, total 20.604 na busca. **Essa contagem é um baseline**, não demonstra o novo fluxo visual. O teste real deve partir de upload na Curadoria 5013, conferir status final e vitrine.
- Fonte detalhada: `docs/relatorios/MISSAO10_CURADORIA_AUTOPUBLICACAO_5013_20261125.md`. O procedimento antigo de abrir Issues é apenas recuperação excepcional.

## Teste do Produto Mestre entre quatro lojas — 26/11/2026
- Implementado diagnóstico estritamente somente leitura em Curadoria → Feeds de parceiros: botão “Verificar tênis em duas ou mais lojas”, que distingue Master confirmado, GTIN em revisão e pareamento sugerido pelo matcher histórico não persistido. Preços regulares 0% estão incluídos; Ficha Inteligente continua desativada na V1. A contagem real de produtos cruzados dependerá da consulta no PostgreSQL da homologação, sem inferir duplicatas a partir de volume de catálogo. Relatório: `docs/relatorios/MISSAO10_MASTER_COMPARACAO_QUATRO_LOJAS_20261126.md`.

## Vitrine filtros recolhidos e timeout do Codespaces — 26/11/2026
- **Implementado e testado**: vitrine Catálogo V2 inicia com todos os grupos de filtros recolhidos (Cor, Tamanho, Marca, Preço, Desconto, etc.), preserva seleções/URL e permite abrir os grupos individualmente. Testes Node e Playwright desktop/mobile concluídos em GitHub Actions #45907013539 SUCCESS, commit de código `b24bb62ca5af3206236fc89f67fe9ce7281f2f70`.
- Codespaces: limite padrão configurável de 5 a 240 min pelo titular em Settings → Codespaces. **Nenhum ajuste automático foi aplicado ao Codespace existente**; mudanças padrão só são garantidas para novos Codespaces. Evitar keepalive e recriação por custo/preservação PostgreSQL. Relatório: `docs/relatorios/MISSAO10_FILTROS_RECOLHIDOS_TIMEOUT_CODESPACES_20261126.md`.
- Preview 5013: Issue #122 solicitada para o commit atualizado; verificar resultado antes de declarar acesso público homologado.
