# Curadoria V3 — Orquestração e journal persistente (23/11/2026)

Repo: `edineilemes-source/beupfree`; branch canônica `feat/uppulse-missao10-supercatalogo`.

**Situação: IMPLEMENTAÇÃO PARCIAL TESTADA NO GITHUB CI; PENDENTE DE HOMOLOGAÇÃO NO CODESPACES E ATIVAÇÃO DO BANCO.**

## Objetivo
O envio/cadastro de um feed deve acionar, sem intervenção humana rotineira, a importação, triagem, Produto Mestre histórico, validação de preço, classificação, normalização, projeção e a visibilidade na loja. Qualquer ambiguidade/erro bloqueia a etapa respectiva, sem inventar atributos, descontos ou equivalências.

## Código desta etapa
- `server/curationSources/curationOrchestrator.ts`: pré-verificação por anunciante, com próximos passos e bloqueios. Exibe cobertura sem interpretá-la como autorização comercial ou Master vigente.
- `server/curationSources/awinFeedUpload.ts` e `client/src/pages/AwinFeedUpload.tsx`: incorporam o plano de execução à auditoria da loja (somente leitura); mostram o próximo módulo e bloqueios por anunciante.
- `server/curationSources/workflowRunner.ts`: executor incremental independente, por `merchantId/feedId/sha256`, com etapas ordenadas, callbacks para os adaptadores existentes, orçamento máximo, checkpoints retomáveis, bloqueio de ambiguidade/falha, liberação de lease e nenhuma execução de módulos de produto por conta própria.
- `server/curationSources/postgresWorkflowJournal.ts`: journal persistente em PostgreSQL com lock de sessão por workflow e recuperação de checkpoints, **não instanciado na aplicação ainda**.
- `migrations/curadoria_v3_workflow_runs_PROPOSTA.sql`: tabela e índice aditivos propostos. **Não executar sem revisão do esquema real, backup verificado e autorização expressa.**
- Testes: `curationOrchestrator.test.ts`, `workflowRunner.test.ts`, `postgresWorkflowJournal.test.ts`, adicionados ao `npm run test:unit`. Preservar regressões existentes.

## Validação
- GitHub Actions UpPulse Release Gate (sem deploy), run `45279307377`, SHA `bfa0ecc57e573458cdbf40dc373e2de06c1cf140`: **SUCCESS**. Testes TypeScript, unidade, catálogo público, build.
- Banco compartilhado: **nenhuma migração executada**, nenhum `db:push`, nenhuma oferta/Produto Mestre/loja publicada por esta execução.
- GitHub Issues #58 STATUS e #59 DIAGNOSTICO abertas em 23/11, sem comentários até a última leitura; ponte Codespaces não confirmada ativa.
- Último Codespaces comprovado em 18/11: contêiner `beupfree-catalog-pg17` parado; operador relatou erro `runc ... container with given ID already exists`. Não presumir recuperado.

## Próximo gate para fluxo realmente automático
1. Recuperar a ponte e o PostgreSQL de homologação preservando volume `beupfree-catalog-pg17-data`, confirmar contagens e backup. Validar snapshot do commit em porta 5011–5015.
2. Revisar e aprovar migração proposta, aplicá-la somente após backup; homologar sessões concorrentes do journal no banco real.
3. Implementar e conectar adaptadores reais de cada passo a `workflowRunner`. Em especial, `processIdentityJob` atual percorre todo o universo e **NÃO pode ser disparado cegamente para cada loja**. Criar escopo com todos os membros Master preexistentes e revisar limites/budgets; garantir operações idempotentes depois de reinício.
4. Integrar preço/evidência comercial e classificação/normalização existentes com execução repetível (o script `awin-regular-catalog-stage.ts` é orientado a staging inicial e bloqueia registros preexistentes); não alterar os classificadores históricos.
5. Integrar projeção/Loja apenas para elegíveis; verificar compras/links, estoque, variantes, versionamento e compatibilidade de preço regular. Não associar automaticamente um produto Master incompleto como equivalência comprovada.
6. Implementar atualização remota periódica por feed, com detecção de versão/hash, backoff, prevenção de feeds incompletos e retirada confirmada; registrar fila de erros/revisões com reprocessamento.
7. Testar ponta a ponta Olympikus 17698/51837, FutFanatics e Dafiti em preview, sem efeitos sobre produção.

## Regra de conclusão
**Não declarar o motor ponta a ponta pronto** até haver handlers reais conectados, journal no banco aprovado, testes de reinício/concorrência, catálogo real e validação visual. O pipeline atual prepara a execução e seus interlocks, não publica produtos automaticamente.
