# Missão 10.6 — Concorrência, deduplicação e orçamento de pesquisas IA

Data: 2026-11-10. Branch: `feat/uppulse-missao10-supercatalogo`. Base de código local: `8afe2dd6a7478858cbd8904f93aeb4a4578ee042`. Base documental remota consultada: `d698d23ec80e7aacc9bc8f45b35f3a0d0eb15fe4`. A especificação e o contrato atual foram recuperados do GitHub nesse commit.

**IMPLEMENTADO e TESTADO localmente. PENDENTE DE HOMOLOGAÇÃO em PostgreSQL.** Código, testes e proposta SQL permanecem locais.

## Coordenação e garantias

- `research.ts` compartilha o trabalho concorrente por SuperHash no escopo de uma instância de cache no processo. O serviço PostgreSQL padrão compartilha a instância de cache entre seus consumidores. Produtos distintos não aguardam um bloqueio comum. Seguidores recebem o resultado com `queried: false`. Um cancelamento de seguidor encerra apenas a espera dele. O cancelamento do iniciador ou o prazo de pesquisa encerra a operação compartilhada. A entrada local é removida no fim da operação.
- A leitura de cache antecede a pesquisa e valida SuperHash e Master ID. Um cache hit não chama o provedor nem reserva orçamento. O serviço relê o cache após a tentativa de adquirir a reserva compartilhada para cobrir gravações concorrentes. Um conflito de Master ID interrompe o fluxo.
- `postgresResearch.ts` e `postgresResearchClaim.ts` usam o pool existente e operações autocommit. A unicidade de SuperHash em `research_claims` permite no máximo um detentor por vez entre processos usando o mesmo banco e o caminho PostgreSQL padrão. O perdedor pode obter um cache hit ou recebe `RESEARCH_IN_PROGRESS`; ele pode consultar novamente depois. A reserva é liberada com SuperHash, Master ID e token do detentor após a operação. Nenhum cliente ou transação fica retido durante pesquisa externa.
- A reserva persistente não expira automaticamente. Uma queda abrupta ou falha ao confirmar a liberação pode exigir recuperação operacional após verificar que o detentor encerrou. Essa escolha impede que uma segunda instância assuma um trabalho ainda ativo. Um provedor pode continuar processando uma requisição já recebida após o cancelamento local; a reserva de orçamento permanece contabilizada.
- O executor transacional opcional da Missão 10.5 continua disponível para homologação com `ROLLBACK`. A reserva entre instâncias requer o caminho autocommit padrão. O piloto em arquivo mantém seu cache local e o mesmo controle obrigatório de orçamento para HTTP real.

## Orçamento e falhas

`researchBudget.ts` centraliza a política e reserva antes de cada chamada HTTP por `liveProvider.ts`. A reserva é um único UPSERT PostgreSQL sobre uma linha de orçamento, com verificação simultânea do saldo agregado e dos contadores independentes de Tavily e OpenAI. O primeiro uso abre a janela configurada. A política fica fixada durante a janela, inclusive entre processos. Configuração incompleta, banco indisponível ou saldo insuficiente bloqueia o envio.

| Variável | Configuração |
| --- | --- |
| `RESEARCH_PAID_ENABLED` | Opt-in explícito. Manter desabilitado. |
| `RESEARCH_POSTGRES_HOMOLOGATED` | Gate operacional após homologação autorizada. Manter desabilitado. |
| `RESEARCH_BUDGET_PERIOD_SECONDS` | Período inteiro positivo. |
| `RESEARCH_BUDGET_USD` | Teto agregado positivo em USD por período. |
| `RESEARCH_TAVILY_MAX_CALLS`, `RESEARCH_OPENAI_MAX_CALLS` | Limites inteiros positivos por operação e período. |
| `RESEARCH_TAVILY_ESTIMATED_USD`, `RESEARCH_OPENAI_ESTIMATED_USD` | Estimativa conservadora positiva por operação, fornecida pelo operador conforme produto/modelo configurado. Valores monetários aceitam até seis casas decimais. |

As estimativas são convertidas para microdólares inteiros. A reserva é o valor estimado debitado da janela antes do envio. Custo real em USD permanece indisponível nesta implementação. Não há precificação presumida, conversão de tokens/créditos em USD ou estorno por erro, timeout ou resposta parcial. Os limites de entrada e de saída do adaptador ajudam a delimitar a estimativa, que deve cobrir o modelo selecionado. Mudanças de preço e cobrança do provedor exigem revisar a configuração antes de habilitar.

O adaptador limita tempo de requisição, propaga cancelamento e não faz retry pago. A extração para ao receber 429 ou recusa de orçamento. Falhas parciais preservam evidências válidas. Uma falha genérica de escrita no cache mantém o resultado enriquecido com aviso. Um conflito de Master ID é propagado. Os diagnósticos usam códigos fixos e não registram prompts, payloads ou credenciais.

## Alterações e verificações

- Produção local: `research.ts`, `postgresResearch.ts`, `postgresResearchClaim.ts`, `researchBudget.ts` e `liveProvider.ts` em `server/productIntelligence/`.
- Testes locais: `research.test.ts`, `postgresResearchClaim.test.ts`, `researchBudget.test.ts` e `liveProvider.test.ts` no mesmo diretório.
- Esquema proposto: `migrations/mission10_research_coordination.sql` adiciona `research_claims` e `research_budget`. A FK consulta a identidade de produto existente. Nenhuma migração ou SQL foi executado nesta sessão. A instância de referência continua `uppulse_catalog`, contêiner `beupfree-catalog-pg17`, host `127.0.0.1:5435`. As contagens comerciais anteriores não foram medidas novamente.
- `npm run check` passou, com arquivo incremental em `/tmp` para preservar `.cache/`. `npm run test:mission10` passou, com sete arquivos aprovados. O comando direcionado `node --import tsx --test --test-isolation=none server/productIntelligence/{research,researchBudget,postgresResearchClaim,liveProvider}.test.ts` passou com 13 testes. `git diff --check` passou.
- A suíte cobre dez concorrentes do mesmo SuperHash, produto independente, cache hit, cancelamento, timeout, falha e conflito de Master ID. Dois coordenadores simulados compartilham um executor de reservas. O simulador de orçamento verifica dez solicitações, teto agregado, contadores separados, opt-in e reserva antes de fetch. Não houve HTTP real, acesso ao PostgreSQL, alteração comercial ou deploy.
- Build, suíte geral e Playwright ficaram fora do escopo desta mudança isolada de servidor. PostgreSQL real e consumo financeiro não foram homologados. A prova de exclusão e atomicidade em banco real permanece pendente de revisão e autorização da migração.

## Próxima ação

Revisar a proposta SQL, confirmar backup e obter autorização explícita antes de qualquer aplicação. Homologar a exclusão por SuperHash e o orçamento com conexões independentes em ambiente autorizado, usando provedor simulado. Validar recuperação de reserva órfã antes de habilitar pesquisa paga.

## Publicação documental

**BLOCKED — RELATÓRIO NÃO PUBLICADO nesta execução.** SHA documental indisponível. O índice do Git retornou `Read-only file system` ao criar `index.lock`. O acesso direto a `github.com` retornou `Could not resolve host: github.com`. O conector confirmou o HEAD remoto e a ausência do relatório nesse commit. A escrita do blob documental foi rejeitada com `MCP tool call requires approval, but approval policy is never`. Nenhum commit ou push foi realizado.

Os três documentos foram preservados e revisados para segredos. O índice local estava vazio. No terminal normal, na raiz do checkout da missão, execute este bloco único. Ele usa um worktree temporário sobre a base remota conferida e publica exclusivamente os três caminhos listados. Se a base remota mudar, o bloco para antes de copiar arquivos.

```bash
bash <<'PUBLICAR_MISSAO_10_6'
set -euo pipefail
branch=feat/uppulse-missao10-supercatalogo
ref="refs/heads/$branch"
base=d698d23ec80e7aacc9bc8f45b35f3a0d0eb15fe4
report=docs/relatorios/MISSAO10_6_CONCORRENCIA_CUSTOS.md
docs=(.ai/NEXT_ACTION.md docs/ESTADO_OPERACIONAL.md "$report")
test "$(git branch --show-current)" = "$branch"
case "$(git remote get-url --push origin)" in
  https://github.com/edineilemes-source/beupfree|https://github.com/edineilemes-source/beupfree.git|git@github.com:edineilemes-source/beupfree.git) ;;
  *) echo "O remoto origin não aponta para o repositório esperado." >&2; exit 1 ;;
esac
git fetch origin "$ref"
test "$(git rev-parse FETCH_HEAD)" = "$base" || { echo "A branch remota avançou. Revise os três documentos sobre a nova base." >&2; exit 1; }
publication_dir=$(mktemp -d /tmp/missao106-docs.XXXXXX)
git worktree add --detach "$publication_dir" "$base"
for path in "${docs[@]}"; do
  cp -- "$path" "$publication_dir/$path"
done
git -C "$publication_dir" add -- "${docs[@]}"
expected=$(printf '%s\n' "${docs[@]}" | LC_ALL=C sort)
staged=$(git -C "$publication_dir" diff --cached --name-only | LC_ALL=C sort)
test "$staged" = "$expected"
printf '%s\n' "$staged"
git -C "$publication_dir" diff --cached --check
git -C "$publication_dir" commit -m "docs(missao10.6): registrar concorrencia e orcamento"
sha=$(git -C "$publication_dir" rev-parse HEAD)
test "$(git -C "$publication_dir" rev-parse HEAD^)" = "$base"
test "$(git -C "$publication_dir" diff-tree --no-commit-id --name-only -r HEAD | LC_ALL=C sort)" = "$expected"
git -C "$publication_dir" push origin "HEAD:$ref"
git -C "$publication_dir" fetch origin "$ref"
test "$(git -C "$publication_dir" rev-parse FETCH_HEAD)" = "$sha"
git -C "$publication_dir" show "FETCH_HEAD:$report" >/dev/null
printf 'SHA: %s\nhttps://github.com/edineilemes-source/beupfree/blob/%s/%s\n' "$sha" "$sha" "$report"
PUBLICAR_MISSAO_10_6
```
