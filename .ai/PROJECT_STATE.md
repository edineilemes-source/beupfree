# Estado do projeto

Estado técnico consolidado e relativamente estável do BeUpFree/UpPulse. Registre aqui somente fatos atuais e úteis entre sessões. As regras do `AGENTS.md` têm precedência; não copie credenciais, tokens, dados pessoais ou conteúdo de `.env`.

## Identidade e arquitetura

- Produto: BeUpFree / UpPulse.
- Arquitetura obrigatória: multi-marketplace.
- Distinção de domínio: Produto não é Oferta; um produto pode ter ofertas de vários marketplaces.
- Pipeline operacional: Coletar → Processar → Triar → Publicar.

## Stack principal

- React 18, TypeScript, Vite, Wouter e TanStack React Query.
- Tailwind CSS e shadcn/ui/Radix.
- Node.js, Express, TypeScript, PostgreSQL e Drizzle ORM.
- Playwright para fluxos de interface e regressão.

## Estado operacional

- Branch de integração e homologação: `codespace-working`.
- Branch de trabalho observada em 2026-09-01: `devai001-agent-workflow`.
- Memória persistente: arquivos versionáveis em `.ai/`.
- Protocolo operacional: DEVAI001.2.
- Executor local do protocolo: `./beupfree-agent`, criado pela DEVAI001.3.
- O executor valida e resume o protocolo, consolida contexto, oferece dry-run e usa `codex exec --sandbox workspace-write -C <repo> -` quando uma missão `PENDING` pode ser executada.
- Após retorno zero do Codex, o executor exige consistência terminal entre `CURRENT_MISSION.md`, `CODEX_REPORT.md` e `NEXT_ACTION.md`; inconsistências produzem falha sem correção automática.
- A ponte operacional usa uma GitHub Issue dedicada como mailbox separada dos commits: `sync` aceita missão estruturada de colaborador, `publish` devolve resultado sanitizado e idempotente e `cycle` encadeia o ciclo completo.
- A bridge depende de `gh` instalado e autenticado; falha de autenticação, rede ou consistência interrompe com segurança sem apagar o resultado local. Na inspeção de 2026-09-02, o CLI estava instalado, mas a autenticação disponível era inválida.
- Logs operacionais locais: `.ai/logs/`; locks transitórios por `mission_id`: `.ai/locks/`.
- Última atualização estrutural: 2026-09-02, durante DEVAI001.6.

## Responsabilidades documentais

| Arquivo | Responsabilidade exclusiva |
| --- | --- |
| `AGENTS.md` | Regras permanentes do agente e do projeto; autoridade sobre o protocolo `.ai/`. |
| `.ai/PROJECT_STATE.md` | Estado técnico consolidado e relativamente estável. |
| `.ai/CURRENT_MISSION.md` | Única missão ativa que o Codex pode executar. |
| `.ai/DECISIONS.md` | Decisões arquiteturais e de produto que sobrevivem entre sessões. |
| `.ai/CODEX_REPORT.md` | Resultado estruturado da última execução. |
| `.ai/NEXT_ACTION.md` | Recomendação objetiva para o próximo ciclo. |

## Protocolo de execução

Uma missão válida possui `mission_id` não concluído, todos os campos obrigatórios e `status: PENDING`. Ao recebê-la, o Codex deve executar, nesta ordem:

1. Ler integralmente `AGENTS.md`.
2. Ler `PROJECT_STATE.md` e `DECISIONS.md`.
3. Validar a branch e o estado do Git, preservando mudanças preexistentes.
4. Alterar `CURRENT_MISSION.md` para `IN_PROGRESS`.
5. Executar autonomamente somente as ações permitidas.
6. Executar os comandos de validação declarados.
7. Corrigir falhas causadas pela missão.
8. Atualizar `PROJECT_STATE.md` apenas se houver mudança estrutural relevante.
9. Acrescentar decisões novas a `DECISIONS.md` sem apagar o histórico.
10. Preencher `CODEX_REPORT.md` e `NEXT_ACTION.md`.
11. Encerrar `CURRENT_MISSION.md` como `COMPLETED`, `BLOCKED` ou `FAILED`.

### Proteção contra loops

- Não executar novamente um `mission_id` já registrado como `COMPLETED` em `CURRENT_MISSION.md` ou `CODEX_REPORT.md`.
- Se `CURRENT_MISSION.md` estiver `COMPLETED`, `BLOCKED` ou `FAILED`, não iniciar automaticamente outra implementação.
- Uma nova execução exige uma nova missão explícita com identificador distinto e status `PENDING`.

### Limites permanentes de autonomia

Mesmo em modo YOLO ou full access, sem autorização explícita continuam proibidos: deploy ou publicação em produção; merge; alteração da `main`; force push; exclusão ou migração destrutiva; exposição de segredos; compra ou transação externa; envio de mensagens externas; e publicação de catálogo real.

## Fluxo entre ambientes

```text
ChatGPT
  → CURRENT_MISSION
  → Codex
  → implementação e validações
  → CODEX_REPORT
  → NEXT_ACTION
  → ChatGPT
```

O protocolo troca estado por arquivos locais; nesta versão não acessa conversas do ChatGPT nem APIs externas. O executor local também não possui acesso automático à memória de uma conversa específica do ChatGPT.

## Como manter

Atualize este arquivo apenas quando um fato durável ou estrutural mudar. Trabalho em andamento pertence a `CURRENT_MISSION.md`; decisões a `DECISIONS.md`; resultados da execução a `CODEX_REPORT.md`; e o próximo passo imediato a `NEXT_ACTION.md`.
