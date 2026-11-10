# Missão 10.6 — Concorrência, deduplicação e orçamento de pesquisas IA

**Repositório:** `edineilemes-source/beupfree`  
**Branch:** `feat/uppulse-missao10-supercatalogo`  
**Base mínima:** código da Missão 10.5 publicado em `8afe2dd`  
**Relatório obrigatório:** `docs/relatorios/MISSAO10_6_CONCORRENCIA_CUSTOS.md`  
**Execução:** Codex CLI no Codespaces, sem chamadas pagas.

## Objetivo

Evitar pesquisas duplicadas do mesmo SuperHash e impedir consumo de APIs Tavily/OpenAI acima de limites configurados. Preservar a associação SuperHash ↔ Master ID, a separação Produto/Oferta e a arquitetura multi-marketplace.

## Diagnóstico (não repetir missões concluídas)

Ler `AGENTS.md`, `docs/ESTADO_OPERACIONAL.md`, `.ai/NEXT_ACTION.md`, `docs/relatorios/MISSAO10_5_INTEGRACAO.md`, `server/productIntelligence/research.ts`, `postgresResearch.ts`, `postgresCache.ts`, `liveProvider.ts`, os testes e migrações pertinentes. Conferir `git status --short`, branch e commit. Preservar alterações existentes.

## Implementação

1. **Deduplicação local:** solicitações concorrentes com mesmo SuperHash devem compartilhar uma única execução de pesquisa; produtos distintos não devem ser serializados sem necessidade. Não reutilizar resultado para Master ID incompatível. Limpar coordenação em sucesso, erro, timeout e cancelamento; evitar promessas presas. Garantir cache-hit sem nova pesquisa.
2. **Múltiplas instâncias:** analisar coordenação compartilhada via PostgreSQL e definir a garantia exata. Um Map local sozinho **não** satisfaz a garantia multi-instância. Preferir solução simples, robusta e compatível com o pool existente; evitar transação longa ou cliente retido durante chamada externa quando possível. Se for necessário esquema novo, criar **apenas** migração aditiva revisável, **sem aplicar**. Se a garantia multi-instância depender dessa migração, marcar `PENDENTE DE HOMOLOGAÇÃO` e manter chamadas pagas desabilitadas. Não afirmar deduplicação global antes de testes adequados.
3. **Orçamento:** implementar controle central server-side, opt-in, **desabilitado por padrão**. Exigir limites finitos e positivos configurados para período, operação e orçamento USD; sem configuração válida, negar chamadas. Contabilizar Tavily e OpenAI separadamente; reservar orçamento **atomicamente antes** de chamar cada API, inclusive sob concorrência. Diferenciar estimativa, reserva e custo real reportado. Não inventar preços: usar custos unitários conservadores fornecidos por configuração e registrar sua natureza. Sem dados de custo real, manter estimativa conservadora. Não liberar reserva de chamada enviada apenas porque falhou ou expirou; evitar ultrapassagem por retry. Evitar logs de segredos, prompts ou payloads.
4. **Integração real:** proteger o caminho de chamadas externas do `liveProvider.ts` e o serviço `postgresResearch.ts`, não apenas uma função isolada não utilizada. Garantir que o piloto em arquivo e provedores simulados continuem funcionando. Não ativar APIs reais.
5. **Falhas:** timeouts, 429, indisponibilidade, quota esgotada, erros parciais e cache.set falhando. Preservar estados `ENRICHED`, `NO_EVIDENCE`, `RESEARCH_FAILED`, com códigos seguros e sem retries pagas automáticas.

## Testes (somente provedores simulados)

- Dez requisições simultâneas ao mesmo SuperHash => uma única pesquisa no escopo garantido.
- Produtos diferentes independentes.
- Falha e timeout liberam a coordenação.
- Segunda chamada reaproveita resultado.
- Limites esgotados impedem chamadas; dez concorrentes não ultrapassam orçamento.
- Tavily e OpenAI têm contabilização separada.
- Sem opt-in, nenhuma chamada paga.
- Conflito de Master ID não é ignorado.
- Se houver garantia multi-instância, testá-la com dois coordenadores/processos usando armazenamento compartilhado simulado ou PostgreSQL autorizado; sem homologação real, declarar limite.
- Não tocar produtos, ofertas ou dados comerciais.

Executar `npm run check`, `npm run test:mission10` e testes específicos. `npm run build` somente se o escopo justificar e recursos permitirem. Registrar testes não executados e motivos.

## Restrições e aprovações

Não chamar Tavily/OpenAI reais, não criar gastos, não executar migração/`db:push`, não alterar banco comercial, não publicar na Hostinger, não remover funcionalidades/testes, não mexer em `.cache/`, backups ou stash, não fazer reset/merge/force push. **Não fazer commit ou push de código nem de migrações.** Se houver migração proposta, deixar arquivo local e solicitar aprovação antes de executar.

## Relatório remoto — entrega obrigatória

Criar e preencher exatamente `docs/relatorios/MISSAO10_6_CONCORRENCIA_CUSTOS.md`, atualizar `docs/ESTADO_OPERACIONAL.md` e `.ai/NEXT_ACTION.md`.

**Autorização explícita:** commit/push **somente desses três documentos** para `feat/uppulse-missao10-supercatalogo`. Antes, inspecionar conteúdo e `git diff --cached --name-only` e conferir que nenhum arquivo de código, segredo, migração ou `.cache/` foi incluído. Confirmar o arquivo acessível no remoto e registrar URL e SHA do commit documental.

Se o sandbox impedir escrita no índice Git, rede ou push, não fingir publicação e não alterar permissões: registrar `RELATÓRIO NÃO PUBLICADO`, preservar os arquivos e informar um comando seguro de publicação documental para o terminal normal. Não declarar entrega documental completa até confirmação remota.

O relatório deve discriminar: arquitetura e escopo da deduplicação, garantias locais/multi-instância, política de orçamento e configuração, alterações, testes executados, banco/migrações, riscos, status (IMPLEMENTADO / TESTADO / PENDENTE DE HOMOLOGAÇÃO / BLOCKED), commit-base, commit documental e próxima ação. Terminar com resumo curto no Codex; o usuário apenas dirá 'terminou' e o ChatGPT consultará o GitHub.

**Critério de conclusão:** implementação testada sem APIs pagas; documentação publicada no GitHub ou bloqueio de publicação explicitamente registrado; nenhuma alegação de homologação multi-instância ou de custo real sem evidência.
