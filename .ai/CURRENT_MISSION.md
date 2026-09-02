# Missão atual

Este arquivo contém uma única missão. Os campos abaixo são YAML simples para leitura humana e por scripts. Os únicos status válidos são `PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED` e `FAILED`.

```yaml
mission_id: DEVAI001.3
title: "Executor local BeUpFree-Agent"
status: COMPLETED
expected_branch: devai001-agent-workflow
objective: "Criar a primeira versão do executor local ./beupfree-agent para validar e operar com segurança o protocolo .ai no GitHub Codespaces."
context:
  - "DEVAI001.1 criou os cinco arquivos persistentes em .ai/."
  - "DEVAI001.2 definiu o protocolo operacional, a máquina de estados e os limites de autonomia."
allowed_actions:
  - "Ler arquivos locais, inspecionar Git e consultar a ajuda do Codex CLI instalado."
  - "Criar o executor, documentação e testes locais sem dependências novas."
  - "Atualizar os arquivos do protocolo .ai conforme o ciclo da missão."
  - "Executar validações locais não destrutivas."
forbidden_actions:
  - "Alterar produto, frontend, backend, banco ou APIs."
  - "Acessar APIs externas ou criar integração direta com conversas do ChatGPT."
  - "Executar commit, push, merge ou deploy."
  - "Executar operações destrutivas ou expor segredos."
acceptance_criteria:
  - "Comandos status, check, context, run --dry-run e run implementados."
  - "Validação estrutural, gates de status e branch, lock e logs seguros implementados."
  - "Interface não interativa real do Codex CLI detectada e usada quando disponível."
  - "Documentação e testes específicos completos."
  - "Relatório e próxima ação persistidos no protocolo .ai."
validation_commands:
  - "./beupfree-agent status"
  - "./beupfree-agent check"
  - "./beupfree-agent context"
  - "./beupfree-agent run --dry-run"
  - "bash tests/beupfree-agent.test.sh"
  - "git diff --check"
  - "git status --short"
```
