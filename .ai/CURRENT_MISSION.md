# Missão atual

Este arquivo contém uma única missão. Os campos abaixo são YAML simples para leitura humana e por scripts. Os únicos status válidos são `PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED` e `FAILED`.

```yaml
mission_id: DEVAI001.4
title: "Ponte segura ChatGPT → GitHub → BeUpFree-Agent → Codex"
status: COMPLETED
expected_branch: devai001-agent-workflow
objective: "Validar e fortalecer a ponte operacional em que o ChatGPT grava uma missão no GitHub, o Codespace a recebe e o beupfree-agent executa o Codex CLI, persistindo relatório e próxima ação para revisão posterior."
context:
  - "DEVAI001.1 criou a memória operacional persistente em .ai/."
  - "DEVAI001.2 definiu o protocolo operacional e seus gates de segurança."
  - "DEVAI001.3 criou e testou ./beupfree-agent com status, check, context, run, dry-run, locks e logs."
  - "A missão DEVAI001.4 foi escrita diretamente pelo ChatGPT no GitHub, eliminando o copiar/colar manual da missão para o Codex."
  - "A ponte atual usa GitHub como meio persistente; não existe acesso automático do executor local à memória privada desta conversa do ChatGPT."
allowed_actions:
  - "Inspecionar e alterar exclusivamente a infraestrutura DEVAI001 necessária para tornar robusto este fluxo."
  - "Atualizar beupfree-agent, testes e documentação se forem identificadas lacunas reais durante o dogfood."
  - "Atualizar os arquivos .ai conforme o protocolo."
  - "Executar validações locais não destrutivas e testes específicos do agente."
  - "Inspecionar Git e a interface local do Codex CLI."
forbidden_actions:
  - "Alterar funcionalidades do UpPulse, frontend, backend da aplicação, banco ou APIs do produto."
  - "Acessar ou expor segredos, .env, DATABASE_URL, tokens ou credenciais."
  - "Fazer merge, alterar main, force push ou deploy."
  - "Executar migrações ou operações destrutivas."
  - "Publicar catálogo real ou executar ações externas de negócio."
  - "Simular ou alegar acesso automático à memória de uma conversa do ChatGPT."
acceptance_criteria:
  - "A missão recebida via GitHub é reconhecida como PENDING pelo executor após sincronização local."
  - "./beupfree-agent check valida o protocolo e a branch corretamente."
  - "./beupfree-agent run executa a missão via interface comprovada do Codex CLI sem copiar o texto da missão para o chat do Codex."
  - "O ciclo atualiza CURRENT_MISSION para um estado terminal verdadeiro e persiste CODEX_REPORT e NEXT_ACTION."
  - "Qualquer lacuna descoberta no executor durante o dogfood é corrigida com testes específicos."
  - "A documentação descreve o fluxo real ChatGPT → GitHub → git pull → beupfree-agent → Codex → relatório, sem prometer integração inexistente."
  - "O relatório final informa claramente o que ainda exige intervenção humana e recomenda a próxima redução de atrito."
validation_commands:
  - "./beupfree-agent status"
  - "./beupfree-agent check"
  - "bash tests/beupfree-agent.test.sh"
  - "git diff --check"
  - "git status --short"
```
