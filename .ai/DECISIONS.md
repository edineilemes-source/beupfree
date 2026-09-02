# Registro de decisões

Registro append-only de decisões técnicas e operacionais que precisam sobreviver entre sessões. Para cada nova decisão, acrescente uma entrada com identificador, data, contexto, decisão e consequências. Não apague decisões superadas: marque-as como substituídas e referencie a nova entrada.

## DEVAI001-D001 — Memória em Markdown versionável

- Data: 2026-09-01.
- Status: aceita.
- Contexto: o projeto precisa preservar contexto operacional sem alterar produto ou infraestrutura de execução.
- Decisão: manter a primeira versão da memória em cinco arquivos Markdown sob `.ai/`, cada um com responsabilidade única.
- Consequências: a memória pode ser revisada por diff e acompanhada pelo Git; sua atualização depende de disciplina ao iniciar e encerrar missões.

## DEVAI001-D002 — Precedência e segurança

- Data: 2026-09-01.
- Status: aceita.
- Contexto: documentos de memória podem ficar desatualizados ou receber conteúdo inadequado.
- Decisão: `AGENTS.md`, código e documentação normativa prevalecem sobre `.ai/`; segredos e dados pessoais nunca devem ser registrados nesses arquivos.
- Consequências: divergências devem ser corrigidas na memória, e fatos devem ser confirmados no repositório antes de orientar alterações.

## DEVAI001-D003 — Separação por horizonte

- Data: 2026-09-01.
- Status: aceita.
- Contexto: misturar estado durável, execução corrente e próximos passos torna a retomada ambígua.
- Decisão: separar estado durável (`PROJECT_STATE.md`), missão ativa (`CURRENT_MISSION.md`), decisões (`DECISIONS.md`), entrega mais recente (`CODEX_REPORT.md`) e próximo passo único (`NEXT_ACTION.md`).
- Consequências: cada encerramento de missão deve sincronizar os cinco documentos apenas quando aplicável.

## DEVAI001.2-D001 — Campos estruturados em YAML dentro de Markdown

- Data: 2026-09-01.
- Status: aceita.
- Contexto: pessoas e scripts precisam interpretar missão, relatório e próxima ação sem infraestrutura adicional.
- Decisão: usar blocos YAML com chaves estáveis dentro dos arquivos Markdown operacionais.
- Consequências: o protocolo permanece simples e legível; automações futuras poderão extrair os blocos sem depender exclusivamente de texto livre.

## DEVAI001.2-D002 — Máquina de estados e execução única

- Data: 2026-09-01.
- Status: aceita.
- Contexto: retomadas automáticas podem repetir trabalho concluído ou iniciar ações após bloqueios.
- Decisão: limitar status a `PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED` e `FAILED`; somente `PENDING` inicia execução, e um `mission_id` concluído não pode ser executado novamente.
- Consequências: estados terminais exigem nova missão explícita e identificador distinto para outro ciclo.

## DEVAI001.2-D003 — Autonomia limitada pelas permissões explícitas

- Data: 2026-09-01.
- Status: aceita.
- Contexto: acesso técnico amplo não equivale a autorização de negócio ou operacional.
- Decisão: manter as proibições críticas do protocolo mesmo em YOLO/full access, incluindo deploy, merge, alteração da `main`, force push, operações destrutivas e ações externas.
- Consequências: qualquer uma dessas ações depende de autorização explícita, independentemente da capacidade disponível no ambiente.

## DEVAI001.3-D001 — Executor shell local e sem dependências

- Data: 2026-09-02.
- Status: aceita.
- Contexto: o protocolo persistente precisava de uma entrada reutilizável no Codespaces para validação, contexto e execução sem depender de APIs externas.
- Decisão: implementar `./beupfree-agent` em Bash, resolvendo a raiz Git pelo local do script e expondo `status`, `check`, `context` e `run`.
- Consequências: o executor permanece auditável e sem dependências adicionais; o parser suporta deliberadamente os campos YAML simples do protocolo, não YAML arbitrário.

## DEVAI001.3-D002 — Codex não interativo com gates preservados

- Data: 2026-09-02.
- Status: aceita.
- Contexto: a versão instalada do Codex CLI oferece `codex exec`, prompt por stdin, diretório de trabalho, sandbox e política de aprovação.
- Decisão: executar por `codex exec --sandbox workspace-write --ask-for-approval on-request -C <repo> -`, fornecendo o contexto consolidado por stdin e reiterando a precedência de `AGENTS.md`.
- Consequências: o wrapper não amplia autonomia e não automatiza commit, push, merge, deploy, publicação ou operação destrutiva; execução real exige missão `PENDING`.

## DEVAI001.3-D003 — Lock por missão e log mínimo

- Data: 2026-09-02.
- Status: aceita.
- Contexto: duas execuções simultâneas do mesmo `mission_id` podem duplicar trabalho, enquanto logs detalhados podem vazar dados.
- Decisão: usar diretório de lock local por `mission_id` e registrar somente timestamp, missão, ação e exit status em `.ai/logs/operations.log`.
- Consequências: concorrência duplicada é recusada, locks obsoletos com PID inexistente são recuperados e interrupções tentam liberar o lock sem alterar falsamente o status da missão.

## DEVAI001.4-D001 — GitHub como ponte persistente, com sincronização e revisão humanas

- Data: 2026-09-02.
- Status: aceita.
- Contexto: o dogfood confirmou que uma missão escrita no GitHub chega ao executor após sincronização local, mas o executor não acessa a memória privada do ChatGPT nem administra o ciclo Git.
- Decisão: documentar a ponte como ChatGPT → GitHub → `git pull` humano → `beupfree-agent` → Codex → relatório local → revisão e envio humanos.
- Consequências: missão e resultados são auditáveis por diff; sincronização, resolução de conflitos, commit, push e retorno ao ChatGPT permanecem fora da autonomia do executor.

## DEVAI001.4-D002 — Interface Codex CLI detectada no dogfood

- Data: 2026-09-02.
- Status: aceita; substitui a menção a `--ask-for-approval on-request` em DEVAI001.3-D002.
- Contexto: a versão instalada de `codex exec` aceita `--sandbox workspace-write`, `-C <repo>` e prompt por stdin, mas não oferece mais `--ask-for-approval`.
- Decisão: invocar `codex exec --sandbox workspace-write -C <repo> -` e cobrir argumentos e stdin com teste específico.
- Consequências: o wrapper permanece compatível com a interface comprovada localmente; o sandbox, `AGENTS.md` e a missão continuam limitando a execução.
