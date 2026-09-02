# BeUpFree-Agent

`beupfree-agent` é o executor local do protocolo persistente em `.ai/`. Ele valida a missão, consolida contexto e, quando autorizado pelo estado da missão, inicia o Codex CLI de forma não interativa. Opcionalmente usa uma GitHub Issue como mailbox operacional; nunca acessa conversas privadas do ChatGPT.

Pode ser chamado da raiz ou de outro diretório pelo caminho do script. A raiz Git é resolvida a partir da localização do próprio executável.

## Comandos

```bash
./beupfree-agent status
```

Resume repositório, branch, estado Git, missão, recomendação e presença dos cinco arquivos obrigatórios. Não lê `.env` nem imprime valores sensíveis.

```bash
./beupfree-agent check
```

Valida raiz Git, `AGENTS.md`, estrutura `.ai`, campos essenciais da missão (`mission_id`, `title`, `objective`, `status` e `expected_branch`), branch declarada, conflitos Git e consistência mínima. Erros impeditivos retornam código diferente de zero.

```bash
./beupfree-agent context
```

Produz uma visão compacta das regras, estado, missão, decisões, relatório, próxima ação e Git. Linhas com indicadores de segredo são removidas. A saída pode ser redirecionada:

```bash
./beupfree-agent context > /tmp/beupfree-agent-context.txt
```

```bash
./beupfree-agent run --dry-run
```

Executa as validações e prepara o contexto, mas não inicia o Codex. Mostra missão, status, branch, mecanismo comprovado e gates de segurança. Para permitir o dogfood e a inspeção durante uma missão, o dry-run aceita `PENDING` ou `IN_PROGRESS`; estados terminais são sempre recusados.

```bash
./beupfree-agent run
```

Aceita somente missão `PENDING`, obtém um lock por `mission_id` e usa a interface instalada `codex exec`, com contexto via stdin, diretório do repositório e sandbox `workspace-write`. A interface atual não expõe `--ask-for-approval`; o sandbox e as regras de `AGENTS.md` continuam sendo os gates efetivos. O executor não concede autorização para commit, push, merge, deploy, publicação ou operação destrutiva. Ausência do CLI é informada sem perder o contexto persistente.

Quando `codex exec` retorna zero, o executor só considera a execução bem-sucedida após validar o contrato de saída:

- `CURRENT_MISSION` mantém o `mission_id` executado e termina como `COMPLETED`, `BLOCKED` ou `FAILED`;
- `CODEX_REPORT` usa o mesmo `mission_id` e seu `final_status` terminal coincide com o status da missão;
- `NEXT_ACTION` usa o mesmo `originating_mission` e contém `recommended_next_mission` legível, inclusive uma indicação explícita como `NONE` quando não houver próxima missão.

Uma inconsistência retorna código não zero, descreve os campos inválidos e não tenta corrigir os arquivos. Se `codex exec` retorna erro, seu código é propagado sem executar a validação pós-execução, preservando a causa original.

Logs operacionais mínimos ficam em `.ai/logs/operations.log`, contendo timestamp, missão, ação e exit status. Locks transitórios ficam em `.ai/locks/`. Interrupções liberam o lock quando possível, são registradas e nunca alteram a missão para `COMPLETED`.

## Bridge por GitHub Issue

A bridge exige `gh` instalado e autenticado no repositório. A verificação suprime a saída de autenticação para não imprimir tokens. O número da Issue é sempre explícito e numérico:

```bash
./beupfree-agent sync --issue 123
./beupfree-agent publish --issue 123
./beupfree-agent cycle --issue 123
```

`sync` lê o corpo da Issue do repositório atual. A autoria precisa ter associação `OWNER`, `MEMBER` ou `COLLABORATOR`, e a missão deve estar entre marcadores exclusivos:

~~~markdown
<!-- BEUPFREE_AGENT:MISSION:v1 -->
# Missão atual
```yaml
mission_id: EXAMPLE001
title: "Exemplo"
status: PENDING
expected_branch: branch-de-trabalho
objective: "Objetivo autorizado"
```
<!-- /BEUPFREE_AGENT:MISSION -->
~~~

O executor limita a entrada a 128 KiB e valida marcadores, campos obrigatórios, formato do `mission_id`, `PENDING`, branch e proteção contra missão já processada antes de substituir `CURRENT_MISSION.md`. O conteúdo nunca passa por `eval`, shell ou expansão de comandos: ele é persistido como dado e continua subordinado ao `AGENTS.md`.

`publish` exige o contrato terminal local válido. Antes de comentar, procura o marcador `BEUPFREE_AGENT:REPORT:v1 mission_id=...` em todos os comentários; se já existir, termina sem duplicar. O comentário contém somente `CURRENT_MISSION`, `CODEX_REPORT` e `NEXT_ACTION` após a mesma sanitização usada no contexto, sem logs brutos ou `.env`. Falha ao consultar ou publicar no GitHub retorna erro e não altera o resultado local.

`cycle` encadeia `sync` → `run` → validação terminal → `publish`. Cada etapa interrompe o ciclo em erro. O comando não faz polling, commit, push, merge, alteração da `main`, deploy, publicação de catálogo ou outra ação irreversível.

## Fluxo real via GitHub

```text
ChatGPT
  → grava missão estruturada na Issue operacional
  → beupfree-agent cycle --issue NUMBER
  → Codex CLI
  → código/testes
  → CODEX_REPORT/NEXT_ACTION sanitizados na Issue
  → pessoa revisa o diff e mantém os gates Git/produção
```

Depois de `sync`, `./beupfree-agent status` mostra a missão recebida e `./beupfree-agent check` confirma protocolo e branch. `run` entrega o contexto persistente ao Codex por stdin; não é necessário copiar a missão para um chat interativo do Codex.

O executor não executa `git pull`, commit ou push e não abre pull request. Ele publica o retorno somente na Issue indicada; não injeta esse retorno em uma conversa do ChatGPT e não possui acesso automático à memória privada dela.

A validação automática confirma somente a coerência estrutural do encerramento. A revisão humana ainda deve avaliar o diff, a veracidade do relatório, a adequação dos testes e qualquer decisão de commit, push ou pull request.
