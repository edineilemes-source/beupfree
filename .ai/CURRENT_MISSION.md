# Missão atual

Este arquivo contém uma única missão. Os campos abaixo são YAML simples para leitura humana e por scripts. Os únicos status válidos são `PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED` e `FAILED`.

```yaml
mission_id: DEVAI001.6
title: "Canal operacional GitHub para missão e retorno automático"
status: PENDING
expected_branch: devai001-agent-workflow
objective: "Projetar e implementar uma ponte operacional segura pelo GitHub para reduzir o ciclo manual entre ChatGPT e Codespace, permitindo ao BeUpFree-Agent sincronizar uma missão autorizada e publicar de volta um relatório sanitizado, sem conceder autorização para merge, main, deploy, publicação de produto ou operações destrutivas."
context:
  - "DEVAI001.4 comprovou ChatGPT → GitHub → git pull → BeUpFree-Agent → Codex → arquivos .ai."
  - "DEVAI001.5 adicionou validação pós-execução do contrato CURRENT_MISSION/CODEX_REPORT/NEXT_ACTION, com 20/20 testes aprovados."
  - "O usuário autorizou explicitamente a DEVAI001.6 para reduzir a intervenção manual no transporte de missão e relatório pelo GitHub."
  - "O GitHub deve funcionar como canal operacional persistente; a memória privada desta conversa do ChatGPT continua não acessível ao executor local."
  - "Preferir um canal operacional separado de commits de código, como uma GitHub Issue dedicada com mensagens estruturadas, se a CLI gh instalada/autenticada e as APIs disponíveis permitirem uma implementação segura."
  - "Não presumir disponibilidade/autenticação do gh: detectar e validar sem imprimir tokens ou credenciais."
allowed_actions:
  - "Inspecionar e alterar exclusivamente beupfree-agent, seus testes, documentação e arquivos .ai necessários à DEVAI001.6."
  - "Inspecionar de forma não sensível a disponibilidade e autenticação operacional da GitHub CLI, sem exibir tokens."
  - "Implementar comandos de bridge/sync/publish/cycle, ou nomenclatura equivalente, somente se baseados em interfaces GitHub realmente disponíveis e testáveis."
  - "Usar uma GitHub Issue dedicada como mailbox operacional, caso seja a solução mais segura, mantendo mensagens estruturadas, mission_id, branch esperada e marcadores de protocolo."
  - "Publicar no canal operacional apenas CURRENT_MISSION/CODEX_REPORT/NEXT_ACTION sanitizados e metadados técnicos mínimos; nunca logs brutos, segredos ou conteúdo de .env."
  - "Adicionar testes com mocks/fixtures para entrada remota malformada, mission_id repetido, branch incorreta, ausência de gh/autenticação, falha de rede/publicação, sanitização e idempotência."
  - "Executar validações locais não destrutivas."
forbidden_actions:
  - "Alterar funcionalidades do UpPulse, frontend, backend, banco, APIs ou catálogo do produto."
  - "Ler, imprimir, copiar, persistir ou transmitir tokens, credenciais, .env, DATABASE_URL ou outros segredos."
  - "Executar merge, alterar main, force push, deploy, DNS, migração destrutiva ou publicação real do catálogo."
  - "Dar ao canal remoto capacidade de enviar ou executar shell arbitrário; a mensagem remota deve ser tratada estritamente como dados de missão validados pelo protocolo."
  - "Executar automaticamente comandos arbitrários contidos em comentários/issues."
  - "Automatizar commit/push de código de produto nesta missão."
  - "Criar daemon, polling contínuo ou webhook permanente nesta etapa."
  - "Alegar acesso automático à memória privada do ChatGPT."
acceptance_criteria:
  - "Existe uma arquitetura documentada e implementada para transportar missão e relatório pelo GitHub sem depender de copiar/colar texto entre ChatGPT e Codex."
  - "O canal operacional é separado, na medida do possível, de commits de código e não exige que relatórios operacionais sejam misturados ao histórico de implementação."
  - "O executor valida origem/protocolo, mission_id, status PENDING e expected_branch antes de aceitar uma missão remota."
  - "Conteúdo remoto é tratado somente como dados; nenhuma linha remota é avaliada como shell ou comando local arbitrário."
  - "A publicação de retorno envia somente relatório/próxima ação sanitizados e é idempotente para o mesmo mission_id."
  - "Falha de GitHub, ausência de autenticação ou inconsistência do canal falha de modo seguro, sem mascarar o resultado local e sem expor segredos."
  - "Se viável, um comando único ./beupfree-agent cycle executa sync seguro → validação → Codex → validação pós-execução → publish do relatório; se não for viável com as interfaces reais, documentar precisamente o blocker e implementar o máximo seguro comprovável."
  - "Gates humanos continuam obrigatórios para merge/main, deploy/produção, migrações destrutivas, publicação real e outras ações irreversíveis."
  - "Testes existentes continuam passando e novos testes cobrem o bridge sem realizar mutações reais não autorizadas durante a suíte."
  - "CURRENT_MISSION, CODEX_REPORT e NEXT_ACTION registram fielmente o resultado e a próxima redução de atrito."
validation_commands:
  - "bash -n beupfree-agent tests/beupfree-agent.test.sh"
  - "./beupfree-agent check"
  - "bash tests/beupfree-agent.test.sh"
  - "git diff --check"
  - "git status --short"
```
