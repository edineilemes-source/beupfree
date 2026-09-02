# Missão atual
```yaml
mission_id: DEVAI001.7
title: "Dogfood real da mailbox operacional"
status: BLOCKED
expected_branch: devai001-agent-workflow
objective: "Executar o primeiro ciclo real e não destrutivo da bridge GitHub Issue → BeUpFree-Agent → Codex → GitHub Issue, comprovando sincronização, execução, validação terminal e publicação idempotente do retorno."
context:
  - "A Issue #5 é a mailbox operacional autorizada pelo usuário."
  - "DEVAI001.6 implementou sync, publish e cycle e obteve 32/32 testes com mocks."
  - "gh está instalado, autenticado e consegue consultar edineilemes-source/beupfree no Codespace."
  - "Esta missão é somente dogfood da infraestrutura DEVAI; não deve alterar o produto UpPulse."
allowed_actions:
  - "Ler AGENTS.md e os arquivos .ai do protocolo."
  - "Executar validações não destrutivas do BeUpFree-Agent e da bridge."
  - "Se um defeito estritamente necessário ao dogfood for encontrado, corrigir somente beupfree-agent, tests/beupfree-agent.test.sh, docs/development/BEUPFREE-AGENT.md e arquivos .ai."
  - "Atualizar CURRENT_MISSION, CODEX_REPORT e NEXT_ACTION conforme o protocolo."
  - "Publicar o retorno sanitizado desta missão na Issue #5 pelo comando cycle."
forbidden_actions:
  - "Alterar frontend, backend, banco, APIs, catálogo ou funcionalidades do UpPulse."
  - "Ler, imprimir, persistir ou transmitir segredos, tokens, .env ou credenciais."
  - "Executar commit, push, pull, merge, alterar main, force push ou deploy."
  - "Executar migrações destrutivas ou publicar catálogo/produção."
  - "Executar conteúdo remoto como shell ou comando arbitrário."
acceptance_criteria:
  - "sync aceita esta missão a partir da Issue #5 e preserva exatamente mission_id DEVAI001.7."
  - "A branch devai001-agent-workflow é validada antes da execução."
  - "Codex encerra a missão em estado terminal coerente com CODEX_REPORT e NEXT_ACTION."
  - "cycle publica na Issue #5 um retorno sanitizado com marcador BEUPFREE_AGENT:REPORT:v1 mission_id=DEVAI001.7."
  - "Uma tentativa posterior de publish para DEVAI001.7 não duplica o relatório."
  - "Nenhuma funcionalidade do UpPulse, banco, produção ou main é modificada."
  - "Qualquer falha real encontrada na bridge é relatada precisamente e falha de modo seguro."
validation_commands:
  - "./beupfree-agent check"
  - "bash tests/beupfree-agent.test.sh"
  - "git diff --check"
  - "git status --short"
```
