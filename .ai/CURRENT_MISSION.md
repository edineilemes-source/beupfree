# Missão atual

Este arquivo contém uma única missão. Os campos abaixo são YAML simples para leitura humana e por scripts. Os únicos status válidos são `PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED` e `FAILED`.

```yaml
mission_id: DEVAI001.5
title: "Validação pós-execução do contrato de saída"
status: COMPLETED
expected_branch: devai001-agent-workflow
objective: "Adicionar ao BeUpFree-Agent uma verificação automática, após codex exec, que confirme que CURRENT_MISSION, CODEX_REPORT e NEXT_ACTION ficaram terminalmente consistentes antes de considerar a execução concluída."
context:
  - "DEVAI001.4 comprovou o fluxo ChatGPT → GitHub → git pull → BeUpFree-Agent → Codex → arquivos .ai locais."
  - "A interface válida nesta versão do Codex CLI é codex exec --sandbox workspace-write -C <repo> -, com contexto via stdin."
  - "O maior risco remanescente identificado pelo próprio Codex é retornar exit 0 sem deixar o protocolo de saída coerente."
  - "A missão deve aumentar confiabilidade do executor sem automatizar commit, push, pull, merge, deploy ou acesso ao ChatGPT."
allowed_actions:
  - "Inspecionar e alterar beupfree-agent, tests/beupfree-agent.test.sh, docs/development/BEUPFREE-AGENT.md e arquivos .ai do protocolo."
  - "Adicionar validação pós-execução, mensagens de erro e testes específicos."
  - "Executar testes locais não destrutivos do executor e comandos de validação Git."
forbidden_actions:
  - "Alterar frontend, backend, banco, APIs ou funcionalidades do UpPulse."
  - "Acessar ou expor segredos, tokens, .env, DATABASE_URL ou credenciais."
  - "Fazer commit, push, pull automático, merge, alterar main, force push ou deploy."
  - "Executar migrações ou operações destrutivas."
  - "Publicar catálogo ou executar ações externas de negócio."
  - "Simular integração automática com a memória privada do ChatGPT."
acceptance_criteria:
  - "Após codex exec retornar sucesso, o wrapper valida que CURRENT_MISSION continua com o mesmo mission_id e está em estado terminal permitido para encerramento."
  - "CODEX_REPORT mission_id corresponde à missão executada e final_status é terminal e coerente com CURRENT_MISSION."
  - "NEXT_ACTION originating_mission corresponde à missão executada e possui recomendação legível ou indicação explícita de ausência de próxima missão."
  - "Se o Codex retornar exit 0 mas o contrato de saída estiver incompleto ou inconsistente, ./beupfree-agent run retorna código não zero e informa claramente a inconsistência sem inventar correções."
  - "Se o Codex retornar erro, o comportamento atual de propagação do exit status é preservado e a validação não mascara o erro original."
  - "Lock e arquivo temporário continuam sendo liberados em sucesso, falha e interrupção."
  - "Os testes cobrem ao menos: saída válida, missão não terminal, mission_id divergente no relatório, status divergente, NEXT_ACTION divergente e retorno não zero do Codex."
  - "Os testes existentes continuam passando."
  - "A documentação descreve claramente o contrato pós-execução e o que ainda depende de revisão humana."
  - "CURRENT_MISSION, CODEX_REPORT e NEXT_ACTION são atualizados ao final desta missão conforme o protocolo."
validation_commands:
  - "bash -n beupfree-agent tests/beupfree-agent.test.sh"
  - "./beupfree-agent check"
  - "bash tests/beupfree-agent.test.sh"
  - "git diff --check"
  - "git status --short"
```
