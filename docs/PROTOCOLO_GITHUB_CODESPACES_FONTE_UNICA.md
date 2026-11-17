# UpPulse — Contrato de fonte única GitHub / Codespaces

**Decisão arquitetural — 2026-11-17.** Este documento governa o trabalho futuro com a ponte ChatGPT ↔ GitHub ↔ Codespaces. Não autoriza produção nem desfaz as restrições de `AGENTS.md`.

## Decisão definitiva

**GitHub é a fonte canônica do código, dos testes, dos relatórios e do estado encerrado das missões.** O Codespaces é um **executor temporário, isolado e descartável**. O checkout local, bancos e previews são ambientes de homologação, não novas fontes oficiais de código. Não adotaremos um fluxo de editar localmente e lembrar de enviar depois.

### Ciclo obrigatório de uma missão
1. ChatGPT consulta branch remota atual e estado documentado. Registra escopo, arquivos permitidos, base-SHA e critério de conclusão. Obtém aprovação do usuário para a mudança e seus efeitos relevantes.
2. ChatGPT cria/atualiza código **diretamente na branch autorizada do GitHub** ou em branch de missão apropriada; registra um **commit SHA completo e imutável**. Nunca executa `reset`, `force push`, merge ou sobrescrita de arquivos locais.
3. Cria-se Issue do tipo `[UPPULSE-AGENT] VALIDAR` ou `PREVIEW` contendo SHA aprovado. O agente no Codespaces faz `git fetch` **somente para ler objetos**; verifica que o SHA pertence à branch liberada; usa `git archive` para executar o exato commit num diretório `/tmp` separado.
4. O agente devolve ao GitHub o SHA realmente testado, os passos executados, status, porta e bloqueios. Não há alteração do checkout local nem necessidade de `git push` pelo Codespaces.
5. Se houver erro, o ChatGPT corrige o código **no GitHub**, obtém novo SHA, despacha nova validação e mantém a anterior como histórico. O SHA original nunca é silenciosamente substituído.
6. A missão só é `COMPLETED` quando há código presente no GitHub, SHA testado com os testes pertinentes, relatório versionado, homologação visual se aplicável e aprovação necessária. Se faltar um requisito: `BLOCKED` ou `PENDING_HOMOLOGATION`. A aplicação da Hostinger segue outro gate.

### Regra para diferenças entre remoto e checkout
- **GitHub adiantado, Codespaces atrasado:** situação normal; testar o SHA remoto em snapshot. Não é bloqueio e **não exige** `git pull` no checkout.
- **Codespaces com alterações locais:** preservar; agente não faz checkout, merge, reset, push ou aplicação de patches. Registrar estado divergente. Código local não publicado **não integra o produto oficial**.
- **Mudanças acidentais criadas somente no Codespaces:** não prosseguir para a próxima missão. Revisar e publicar o patch pelo canal autorizado com aprovação explícita; nunca descartar nem presumir que já está no GitHub.
- **Novas missões:** partir do SHA remoto e do relatório versionado da missão anterior; não de uma pasta temporária nem da porta que respondeu por último.
- **Validação antiga:** não constitui validação de commit novo. Cada relatório deve trazer o SHA exato.

### Componentes e dependências
- Um coordenador persistente em Python 3, `gh` CLI autenticado com acesso a Issues, Git, Node.js 20+, npm, tar, curl e inspeção de portas. Docker é obrigatório **apenas para preview com catálogo PostgreSQL**; testes sem DB podem prosseguir sem Docker. `tsx` e demais dependências são as do `package-lock.json` da aplicação.
- GitHub Actions executa verificações independentes do Codespace, usando código do GitHub. Não basta estar verde no Codespace se o SHA difere.
- `gh codespace` é subcomando útil para acesso remoto pelo CLI quando aplicável, mas não é dependência do agente que já roda **dentro** do Codespace. Codex CLI é opcional, não é requisito da ponte.
- Executar `scripts/uppulse_bridge_doctor.py` **antes** de instalar/atualizar o agente. O diagnóstico não usa segredos nem altera o ambiente.
- Nenhuma dependência deve ser instalada automaticamente por um Issue; providenciar instalação consciente e idempotente. Se faltar uma ferramenta, bloquear informando **qual**, não tentar improvisar um fluxo alternativo.
- A branch atual não possui configuração de devcontainer versionada. **Não prometer recuperação após rebuild/stop** até identificar o devcontainer realmente em uso e validar `postStart` em ambiente de testes. O agente pode sobreviver ao fechamento do terminal enquanto Codespace estiver ativo, não ao desligamento da VM.
- GitHub Issue **não inicia sozinho** um Codespace desligado. É preciso iniciar Codespace pela interface ou ação externa autorizada que tenha permissão de Codespaces; o conector atual do chat não possui terminal remoto de Codespaces.

### Agentes/subsistemas definidos
- **Coordenador/fila e autorização** — recebe apenas Issues do proprietário com comandos fechados; registra execução uma vez.
- **Diagnóstico** — versões e disponibilidade, GH auth, branch, SHA local/remoto, processos próprios, banco opcional.
- **Validação** — `tsc` e testes permitidos em snapshot imutável; ampliar perfis por missão com testes de UX, backend, banco e build, sem aceitar comandos shell no corpo das Issues.
- **Preview** — processo isolado de commit identificado, porta reservada, logs locais; só encerra PIDs criados pelo coordenador e nunca usa `kill` em porta alheia.
- **Relator/estado da missão** — resultados devolvidos em comentários de Issue e relatório GitHub, garantindo rastreabilidade.
- **Publicação/produção e migrações** — **fora do escopo do coordenador de homologação**; exigem autorização separada e gates próprios.

### Estado da implementação inicial
A ponte V1 existente (STATUS, VALIDAR, PREVIEW e PARAR PREVIEW) é um **primeiro subconjunto** desses requisitos. Até a validação de integração real, não declarar que o usuário pode executar qualquer missão pelo chat. Particularmente, os testes permitidos V1 são direcionados à Ficha Inteligente; o seletor de testes por tipo de missão e o autostart pós-rebuild **ainda exigem implementação**.

**Importante:** a frente de Enriquecimento da Ficha Inteligente está congelada. A ponte é infraestrutura; não implica novas pesquisas ou aprovação comercial da ficha.
