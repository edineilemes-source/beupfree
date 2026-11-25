# AGENTS.md — BeUpFree / UpPulse

## Objetivo do agente

Trabalhe com autonomia para analisar, implementar, testar e revisar melhorias no BeUpFree/UpPulse. Evite perguntas desnecessárias. Para decisões técnicas reversíveis e compatíveis com estas regras, escolha a alternativa mais segura e prossiga.

Pergunte ao usuário somente quando houver:

- decisão de negócio que altere o produto de forma relevante;
- risco de perda ou migração destrutiva de dados;
- necessidade de credencial, segredo ou autorização externa;
- ação irreversível;
- publicação em produção;
- conflito real entre requisitos que não possa ser resolvido pelo código ou pela documentação.

## Regra estrutural obrigatória: multi-marketplace

Todas as funcionalidades devem ser concebidas como multi-marketplace desde a origem.

- Mercado Livre é apenas o primeiro parceiro.
- Arquitetura, domínio, banco, APIs, Favoritos, Minha Lista, comparação, histórico, alertas, links afiliados e interface não podem depender exclusivamente do Mercado Livre.
- Não use nomes genéricos acoplados a `ml`, `meli` ou `mercado_livre`.
- Integrações específicas devem ficar atrás de adaptadores, serviços ou módulos de marketplace.
- Preserve a distinção: Produto não é Oferta.
- Um produto pode ter ofertas de vários marketplaces.
- Regras específicas de um parceiro não devem contaminar o modelo de domínio.

Código legado específico do Mercado Livre pode continuar existindo, mas novas funcionalidades e refatorações devem reduzir o acoplamento progressivamente.

## Base de trabalho e Git

- A branch de integração e homologação é `codespace-working`.
- Crie uma branch específica para cada tarefa a partir de `codespace-working`.
- Não altere, force-push, resete ou faça merge na `main` sem autorização explícita.
- Não faça merge automaticamente.
- Ao concluir uma tarefa, prepare commit e pull request para `codespace-working`.
- Preserve alterações existentes que não pertençam à tarefa.
- Antes de editar, verifique o estado do repositório e os arquivos relevantes.
- Nunca inclua `.env`, credenciais, tokens ou segredos no Git.

## Ambiente

Stack principal:

- React 18 + TypeScript + Vite;
- Wouter;
- TanStack React Query;
- Tailwind CSS + shadcn/ui/Radix;
- Node.js + Express + TypeScript;
- PostgreSQL + Drizzle ORM;
- Playwright.

No GitHub Codespaces, o ritual oficial é:

```bash
cd /workspaces/beupfree
./start-codespace.sh
```

O script controla a porta 5000. Não encerre processos existentes para liberar essa porta. Se o UpPulse já estiver respondendo com HTTP 200, reutilize a instância existente.

No Codex Cloud, não execute `start-codespace.sh` como configuração persistente. Instale dependências no setup e inicie o servidor somente quando a tarefa ou um teste precisar dele.

## Fluxo autônomo de execução

Para cada solicitação:

1. Entenda o comportamento atual pelo código, testes e documentação.
2. Defina internamente um plano curto.
3. Implemente a menor mudança completa que resolva a solicitação.
4. Atualize ou crie testes relevantes.
5. Execute verificações proporcionais ao risco.
6. Corrija falhas causadas pela mudança.
7. Revise o diff em busca de regressões, acoplamento e segredos.
8. Entregue um resumo objetivo com arquivos alterados, testes executados e limitações reais.

Não pare apenas em análise quando a solicitação pedir implementação. Não peça confirmação entre essas etapas.

## Verificação

Comandos disponíveis:

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run test:regression
npm run test:public-demo
npm run build
```

Use verificações proporcionais:

- alteração pequena de lógica: `npm run check` e testes unitários relacionados;
- frontend ou fluxo do usuário: acrescente Playwright relevante;
- mudança transversal ou preparação de PR: execute `npm run check`, `npm run test:unit` e `npm run build`;
- execute a regressão completa quando a mudança afetar navegação, catálogo, favoritos, comparação, autenticação ou integrações centrais.

Se um teste não puder rodar por falta de banco, segredo, rede ou serviço externo, registre exatamente o impedimento. Não invente resultados.

## Banco de dados e integrações

- Trate `DATABASE_URL` e outras credenciais como segredo.
- Não execute migração destrutiva nem `db:push` em banco compartilhado sem autorização explícita.
- Prefira migrações aditivas e compatíveis.
- Coletores e integrações externas devem tolerar indisponibilidade, limites, respostas incompletas e mudanças de formato.
- Não faça chamadas reais que publiquem, comprem, enviem mensagens ou modifiquem serviços externos sem autorização.
- Preserve o pipeline Coletar → Processar → Triar → Publicar.

## Interface

- Preserve o design responsivo e mobile-first.
- Siga os componentes e tokens existentes antes de criar novos padrões.
- Estados de carregamento, vazio, erro e sucesso fazem parte da entrega.
- Evite textos ou controles que suponham um único marketplace quando o conceito for geral.
- Não remova funcionalidades ou testes para fazer uma nova alteração passar.

## Segurança operacional

Sem autorização explícita, não:

- publicar na Hostinger;
- alterar DNS ou domínio;
- fazer merge;
- alterar a `main`;
- remover dados;
- executar comandos destrutivos;
- expor segredos;
- desativar testes, autenticação ou validações de segurança.

## Critério de conclusão

Uma tarefa está concluída quando:

- o comportamento solicitado foi implementado;
- a arquitetura multi-marketplace foi preservada;
- os testes relevantes foram atualizados e executados;
- o código foi revisado;
- limitações e verificações não executadas foram declaradas;
- a alteração está pronta para revisão em branch ou pull request separado.


## Continuidade operacional — Missão 10.1 (2026-11-10)

- **Antes de qualquer missão**, consultar `docs/ESTADO_OPERACIONAL.md`, `.ai/NEXT_ACTION.md`, este AGENTS.md e código/testes relevantes. As referências antigas deste arquivo a branch, pasta e script de inicialização são históricas e **não substituem a verificação da branch e do ambiente atuais**.
- Não inferir banco de dados pelo nome de diretório, arquivo `.env` antigo ou porta padrão. A referência de homologação confirmada em 2026-11-10 é `uppulse_catalog` no contêiner `beupfree-catalog-pg17` (host 5435), conforme `docs/ESTADO_OPERACIONAL.md`. Reconferir estado antes de escrever.
- **Critério adicional de conclusão**: atualizar o estado operacional e salvar relatório de execução em `docs/relatorios/` na branch do GitHub. O relatório deve conter commit, alterações, verificações executadas e não executadas, dados/banco impactados, riscos e próximo passo. Não pedir ao usuário que copie relatório para o chat quando o GitHub estiver acessível.
- Se a missão não puder atualizar os registros ou validar o ambiente, registrar `BLOCKED`/pendência, não declarar `COMPLETED`.
- O usuário pode interromper Codex com Ctrl+C; preferir alterações diretas no GitHub quando possível. Não iniciar processos Codex longos sem necessidade.
- Toda alteração de esquema exige revisão, backup confirmado e autorização explícita; proibir `db:push` indiscriminado. Nunca publicar credenciais ou dumps no repositório.


## Contrato obrigatório de entrega GitHub — Missões 10.6+ (2026-11-10)

**Fonte canônica atual:** repositório `edineilemes-source/beupfree`, branch `feat/uppulse-missao10-supercatalogo`, checkout observado `/workspaces/uppulse-homologacao/missao9/codigo`. Os caminhos `codespace-working` e `/workspaces/beupfree` citados acima são históricos e não prevalecem nesta missão. Confirmar com `git branch --show-current` antes de agir.

1. **Um relatório por missão:** `docs/relatorios/MISSAO10_<numero>_<assunto>.md`, com caminho exato definido na missão. Não inventar outro diretório ou branch. A atualização de `docs/ESTADO_OPERACIONAL.md` e `.ai/NEXT_ACTION.md` acompanha o relatório.
2. **Publicação documental autorizada:** após revisão e remoção de segredos, Codex pode fazer commit/push **somente** desses três arquivos documentais para a branch atual indicada acima. Código, migrações, testes e configurações NÃO podem ser incluídos nesse commit sem autorização separada. Não usar `git add .`, `git add -A` nem `git push --force`. Verificar o índice com `git diff --cached --name-only` e inspecionar commits a enviar.
3. **Entrega só é considerada publicada quando comprovada no remoto:** confirmar `git ls-remote`/consulta GitHub e leitura do relatório na branch remota; registrar SHA do commit documental e URL exata no resumo final. Criar o arquivo apenas no Codespaces não é publicação.
4. **Se sandbox, DNS, GitHub ou Git index impedir publicação:** não mudar permissões indiscriminadamente, não contornar controles, não afirmar que publicou. Registrar `RELATÓRIO NÃO PUBLICADO` e o erro exato, preservar todos os arquivos, e fornecer **um único comando seguro** para publicação documental pelo terminal normal, ou usar conector GitHub autorizado se disponível. Não bloquear a implementação por causa da publicação.
5. **Ao usuário basta dizer 'terminou':** o ChatGPT deve buscar diretamente o caminho canônico no GitHub e ler o relatório, sem pedir cópia de logs quando ele estiver publicado. Se o relatório remoto não existir, declarar isso e resolver o bloqueio concreto.
6. **Rastreabilidade:** indicar branch, commit-base, commits documentais, arquivos de código ainda locais, testes realmente executados, banco/impactos, migrações pendentes, riscos e próxima ação. Diferenciar `IMPLEMENTADO`, `TESTADO`, `HOMOLOGADO`, `PUBLICADO` e `BLOCKED`.
7. Não apagar `.cache/`, backups ou stash; não fazer reset, merge, migração, deploy ou chamada paga sem autorização correspondente.


## Protocolo de fonte única GitHub / Codespaces — 2026-11-17 (PREVALECE sobre instruções operacionais históricas)
**Referência:** `docs/PROTOCOLO_GITHUB_CODESPACES_FONTE_UNICA.md`.
- **GitHub remoto é canônico para CÓDIGO e TESTES; Codespaces é EXECUTOR**, não repositório concorrente. ChatGPT salva código aprovado na branch autorizada GitHub; agente Codespaces executa commit SHA explícito em snapshot `git archive` isolado.
- Não solicitar `git pull` no checkout local para fazer validação. Divergência entre SHA local e remoto é relatada, mas não bloqueia snapshot do SHA remoto. Não executar `reset`, `checkout`, `merge`, `git apply`, `push` ou `commit` no checkout para remediar diferença.
- Nunca tratar código modificado apenas no Codespaces como publicado. Se algum arquivo local precisar se tornar oficial, fazer revisão/consentimento e publicar por um processo separado, antes de encerrar a missão.
- Missão encerrada somente com SHA remoto inequívoco, testes adequados comprovados, relatório versionado no GitHub e homologação visual quando aplicável. Manter resultados `PENDING_HOMOLOGATION` e `BLOCKED` separados de `COMPLETED`.
- Coordenador GitHub Issues é **restrito e não aceita shell**. Fluxos de produção, migrações, mudanças de banco ou instalação de dependências não se tornam autorizados por um Issue.
- O agente instalado e seu autostart após rebuild são diferentes: **não declarar autostart homologado** enquanto a configuração real do devcontainer não for inspecionada e testada. `scripts/uppulse_bridge_doctor.py` é a verificação obrigatória de ferramentas.
- O enriquecimento da Ficha Inteligente permanece **congelado**, independentemente do desenvolvimento desta ponte.


## Preparação de lançamento — ponte atualizada, 2026-11-17
- **Não confundir agente V1 instalado com código V1.2 publicado**: após novos commits, atualizar agente residente somente pelo instalador `scripts/uppulse_bridge_install.sh`, que confirma PID próprio antes de reiniciar o processo. Não reiniciar servidores da aplicação inadvertidamente.
- `scripts/uppulse_bridge_ensure.sh` reativa o coordenador quando um terminal interativo é aberto, mediante hook instalado em `~/.bashrc`; **não** acorda Codespace parado e não comprova reconstrução do devcontainer. Evitar prometer disponibilidade contínua.
- As operações do agente incluem `STATUS`, `DIAGNOSTICO`, `CATALOGO` (contagens SQL fixas read-only), `VALIDAR`, `PREVIEW` (portas 5011–5015) e `PARAR PREVIEW`. Testes específicos de UI e build têm perfis fechados, nunca aceitar shell arbitrário de Issue.
- Histórico real: Issue #20 STATUS OK; #21 validação basic OK; #22 preview bloqueado; #23 build bloqueado no agente antigo sem diagnóstico suficiente. **Resolver causas concretas antes de afirmar que o UpPulse está no ar.**
- `docs/relatorios/UPPULSE_PREPARACAO_LANCAMENTO_2026-11-17.md` e Issue #24 registram os gates de catálogo, integração e Hostinger.
- Publicação em produção exige destino PostgreSQL permanente, credenciais provisionadas em Hostinger, verificação dos produtos/ofertas elegíveis e testes no domínio. Não utilizar PostgreSQL em Codespaces como banco de produção, nem migrar dados automaticamente.

## Contrato permanente de entrada de parceiros AWIN (25/11/2026)

- **Decisão comercial aprovada e imutável sem nova decisão explícita:** tênis de preço regular **não** podem ser excluídos apenas por falta de promoção. Representar comercialmente como `REGULAR_PRICE`, `previous_price=current_price` e `discount_percent=0`, preservando no raw o preço anterior ausente. Em ordenação por desconto, 0% deve vir depois das promoções válidas. Nunca inventar `old_price` a partir de `base_price`, parcelamento ou RRP.
- O pipeline multiempresa é `scripts/awin-partner-onboard.py`, Produto Mestre em `scripts/awin-partner-master.ts` e integração GitHub restrita `INTEGRAR_AWIN` no agente Codespaces. **Não criar nova missão/instalador específico para cada anunciante**; fornecer somente IDs AWIN `merchant` e `feedId`. Código e classificação não podem conter hardcode comercial de Olympikus, Dafiti ou FutFanatics.
- O fluxo administrativo de upload/triagem e staging permanece `server/curationSources/awinFeedUpload.ts`; depois dele a ação autenticada `INTEGRAR_AWIN` automatiza backup/restauração, migrações necessárias, Master, evidência de preço, classificação, normalização, projeção e auditoria de visibilidade. O executor atua apenas no clone auditado. Não tornar gravações disponíveis em endpoint público, conta de teste sem autenticação ou produção.
- Preservar ofertas e dados de todos os demais lojistas, distinguir Produto e Oferta, aplicar quarentena para registros incertos, e tratar atualização de feeds de lojistas existentes como fluxo incremental separado; não aceitar `--promotion-only` como regra universal.
- Não assumir correspondência entre produtos mestres de lojas diferentes sem o matcher histórico e evidências revisáveis. A criação do Master do novo parceiro não certifica equivalência com lojas já presentes.
- Consultar `docs/relatorios/MISSAO10_PIPELINE_GENERIC_AWIN_20261125.md` antes de alterar importadores ou fluxo de publicação. Testes: `scripts/awin-partner-onboard.test.ts` junto à suíte unitária, `npm run check` e build no release gate.
