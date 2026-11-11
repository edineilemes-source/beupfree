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
