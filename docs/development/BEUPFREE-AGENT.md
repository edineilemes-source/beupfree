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

Aceita somente missão `PENDING`, obtém um lock por `mission_id` e usa a interface instalada `codex exec`, com contexto via stdin, diretório do repositório, sandbox `workspace-write` e aprovações `on-request`. O executor não concede autorização para commit, push, merge, deploy, publicação ou operação destrutiva. Ausência do CLI é informada sem perder o contexto persistente.

Logs operacionais mínimos ficam em `.ai/logs/operations.log`, contendo timestamp, missão, ação e exit status. Locks transitórios ficam em `.ai/locks/`. Interrupções liberam o lock quando possível, são registradas e nunca alteram a missão para `COMPLETED`.

## Fluxo

```text
ChatGPT
  → CURRENT_MISSION
  → beupfree-agent
  → Codex CLI
  → código/testes
  → CODEX_REPORT/NEXT_ACTION
  → revisão
```

O executor local não possui acesso automático à memória de uma conversa específica do ChatGPT. Essa ponte será tratada em missão posterior.
