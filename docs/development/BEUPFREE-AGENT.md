# BeUpFree-Agent

`beupfree-agent` é o executor local do protocolo persistente em `.ai/`. Ele valida a missão, consolida contexto e, quando autorizado pelo estado da missão, inicia o Codex CLI de forma não interativa. Não usa APIs externas nem acessa conversas do ChatGPT.

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

## Fluxo real via GitHub

```text
ChatGPT
  → grava CURRENT_MISSION no GitHub
  → pessoa revisa/sincroniza a branch no Codespace (git pull)
  → beupfree-agent
  → Codex CLI
  → código/testes
  → CODEX_REPORT/NEXT_ACTION
  → pessoa revisa o diff e decide como enviar os resultados ao GitHub
```

Depois da sincronização, `./beupfree-agent status` deve mostrar a missão recebida e `./beupfree-agent check` deve confirmar protocolo e branch. `./beupfree-agent run` entrega o contexto persistente ao Codex por stdin; não é necessário copiar a missão para um chat interativo do Codex.

O executor não executa `git pull`, commit ou push, não abre pull request e não devolve o relatório ao ChatGPT. Essas etapas continuam humanas. Ele também não possui acesso automático à memória privada de uma conversa específica do ChatGPT: somente o conteúdo persistido e sincronizado no repositório entra no contexto.

A validação automática confirma somente a coerência estrutural do encerramento. A revisão humana ainda deve avaliar o diff, a veracidade do relatório, a adequação dos testes e qualquer decisão de commit, push ou pull request.
