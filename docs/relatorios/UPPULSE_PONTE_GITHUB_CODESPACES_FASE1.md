# Integração ChatGPT → GitHub → Codespaces — ponte UpPulse (fase 1)

**Situação:** arquivos publicados na branch `feat/uppulse-missao10-supercatalogo`; **agente ainda não instalado nem comprovadamente executando no Codespaces**. Nenhuma porta da aplicação foi modificada. A frente de pesquisa e enriquecimento da Ficha Inteligente continua congelada.

## Arquitetura verificada
A integração do BI Factory em branches `feat/ponte-github-codespaces-20261113` e `fix/recuperacao-homologacao-20261116` utiliza GitHub Issues, `gh` autenticado e processos no Codespaces. O UpPulse reaproveita o padrão, mas evita agentes independentes sem coordenação, shell arbitrário nas Issues e troca de branch local.

### Contrato V1
Arquivo `scripts/uppulse_codespace_agent.py`:
- Polling de Issues abertas do repositório `edineilemes-source/beupfree` a cada 25 segundos, **somente Issues criadas por `edineilemes-source`** e com título numa lista fechada.
- Operações permitidas:
  - `[UPPULSE-AGENT] STATUS`: corpo vazio ou `{}`; informa branch e portas próprias.
  - `[UPPULSE-AGENT] VALIDAR`: JSON com `{"commit":"<SHA de 40 dígitos>"}`; executa `npm run check` e testes unitários direcionados de IA sem chamadas pagas, em snapshot `git archive` isolado.
  - `[UPPULSE-AGENT] PREVIEW`: JSON com `{"commit":"<SHA de 40 dígitos>","port":5011}`; valida, sobe `npm run dev` na porta permitida e verifica HTTP, usando contêiner PostgreSQL de homologação previamente conhecido.
  - `[UPPULSE-AGENT] PARAR PREVIEW`: JSON com `{"port":5011}`; encerra **apenas** um processo cuja identidade/pid e início tenham sido registrados pelo próprio agente.
- Portas do agente: **5011 a 5015**. Portas atuais 5000, 5005–5010 e quaisquer outras não gerenciadas não são alteradas.
- Branch remota permitida fixa `feat/uppulse-missao10-supercatalogo`; commit precisa pertencer ao histórico dessa branch.
- Sem `git checkout`, `reset`, `merge`, `git apply`, `commit`, `push`, execução de shell fornecido por Issue, migrações ou escrita no catálogo.
- Sem publicação de portas como públicas; abrir o navegador pela guia **PORTS → Open in Browser**. A configuração de visibilidade é responsabilidade do Codespaces.
- O agente reserva as Issues processadas em `~/.local/state/uppulse-bridge/done.json` para não repetir execução em reinícios. Comenta o resultado e fecha a Issue somente em caso de sucesso. Em falhas, a Issue permanece aberta sem executar novamente automaticamente.
- Consulta a fila pelo `gh`; não utiliza tokens colados no chat nem armazena credenciais no Git.

### Instalação inicial — uma vez
**Requer execução humana no terminal Codespaces pelo menos uma vez**, pois o conector GitHub aqui não fornece terminal no Codespaces. O instalador não altera o checkout Git e instala os arquivos sob `~/.local/share/uppulse-bridge`, logs em `~/.local/state/uppulse-bridge`.

```bash
cd /workspaces/uppulse-homologacao/missao9/codigo || exit 1
git fetch origin feat/uppulse-missao10-supercatalogo &&
git show origin/feat/uppulse-missao10-supercatalogo:scripts/uppulse_bridge_install.sh | bash
```

Pré-requisitos: `gh` autenticado no usuário `edineilemes-source`, Python 3, `node_modules` existente e contêiner `beupfree-catalog-pg17` ativo **somente para PREVIEW**.

Quando aparecer `UPPULSE_BRIDGE_READY`, o ChatGPT poderá criar uma Issue autorizada e acompanhar os comentários de retorno pelo conector GitHub. Isso elimina copia/cola nos **comandos das próximas tarefas enquanto o agente estiver ativo**, mas não é prova de que possa ligar um Codespace parado.

### Limitações e trabalho futuro
- **Codespace desligado:** agente não roda. É necessário iniciar/reabrir o Codespaces por meio do GitHub. O GitHub Issue isolado não acorda Codespace parado.
- **Rebuild/restart do devcontainer:** precisa instalar `postStartCommand` conforme a configuração real do devcontainer em uso (ainda não verificada). Não substituir a configuração existente sem inspeção.
- **Abrir navegador:** o agente inicia/verifica serviços e informa a porta. Abrir automaticamente uma aba no dispositivo do usuário não é garantido via conector.
- **Aplicar patches ao checkout local:** propositalmente não implementado nesta fase, por risco de arquivos locais editados. O código novo pode ser salvo no GitHub por ChatGPT, testado em snapshot isolado e aprovado antes de criar um fluxo de aplicação controlada.
- **Banco PostgreSQL:** PREVIEW usa a base de homologação em modo de aplicação com jobs externos e pesquisa paga desativados, mas não impõe permissões SQL somente leitura no usuário do banco. Restringir privilégios se for necessária garantia formal de leitura.
- **Teste de ponta a ponta:** apenas após instalação, criar Issue de STATUS e depois VALIDAR, conferindo resposta real do Codespaces. Sem isso, não afirmar integração funcionando.

## Verificações estáticas
`scripts/uppulse_codespace_agent.test.py` testa lista de operações, SHA completo, portas autorizadas, bloqueio de parâmetros extras e não encerramento de processos alheios. Workflow `.github/workflows/uppulse-bridge-check.yml` roda análise de sintaxe Python, testes e `bash -n` do instalador.

**Critério de aceite:** instalação ativa no Codespaces + Issue STATUS devolve branch real + Issue VALIDAR de SHA autorizado passa + PREVIEW 5011 devolve HTTP e porta utilizável, sem alterar portas anteriores. Documentar persistência do agente antes de considerar operação 100% autônoma.
