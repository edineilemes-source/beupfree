# Próxima ação

Recomendação objetiva para o próximo ciclo. Este arquivo não autoriza execução: uma implementação futura exige nova missão explícita em `CURRENT_MISSION.md`, com outro `mission_id` e `status: PENDING`.

```yaml
originating_mission: DEVAI001.4
recommended_next_mission: "DEVAI001.5 — validar automaticamente o contrato de saída após codex exec."
reason: "A maior redução de atrito segura agora é detectar quando o Codex retorna sem deixar CURRENT_MISSION terminal e CODEX_REPORT/NEXT_ACTION coerentes, mantendo sincronização e publicação Git sob revisão humana."
requires_user_decision: false
requires_chatgpt_review: true
```
