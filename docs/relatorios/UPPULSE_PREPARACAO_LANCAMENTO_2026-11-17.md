# UpPulse — Preparação operacional para lançamento

Atualizado: 2026-11-17. **Não é declaração de produção publicada.**

## Diretriz de trabalho
O GitHub `edineilemes-source/beupfree` é fonte oficial; Codespaces executa snapshots de commits e devolve resultados por Issues. Não editar checkout local para tarefas iniciadas pelo ChatGPT, não misturar diferenças locais com publicações e não executar `git pull/reset` indiscriminadamente. Branch atual de homologação: `feat/uppulse-missao10-supercatalogo`. A integração de enriquecimento técnico da Ficha Inteligente está **congelada**.

## O que foi confirmado em execução real
- Issue [#20](https://github.com/edineilemes-source/beupfree/issues/20): STATUS concluído, com GitHub/códigos divergentes identificados e checkout local com modificações (preservadas).
- Issue [#21](https://github.com/edineilemes-source/beupfree/issues/21): validação TypeScript + testes básicos em SHA `cda8173c0421447592cfa45a508989a4793e993e`: **SUCCESS**.
- Issue [#22](https://github.com/edineilemes-source/beupfree/issues/22): tentativa PREVIEW 5011 no mesmo SHA: **BLOCKED**, agente V1 não deu motivo específico. Porta/aplicação **não confirmada**. Não forçar parada de serviços.
- Issue [#23](https://github.com/edineilemes-source/beupfree/issues/23): teste perfil `build` em SHA `0ad09c7793723039e8bc4c07bb2628cf1d780028`: **BLOCKED**, agente V1 não relatou etapa exata. Não declarar build aprovado.

## Melhorias de infraestrutura publicadas após bloqueios
- Agente `scripts/uppulse_codespace_agent.py` atualizado para informar códigos seguros de bloqueio, suportar operações read-only `DIAGNOSTICO` e `CATALOGO`, testar perfis fechados e não repetir Playwright em loop.
- Instalador `scripts/uppulse_bridge_install.sh` detecta versão nova por hash, para apenas o processo do agente quando confirmado como seu próprio processo, e o reinicia com versão atualizada. Não interrompe a aplicação nem modifica checkout.
- `scripts/uppulse_bridge_ensure.sh` é instalado como hook idempotente de `~/.bashrc`: quando um terminal interativo do Codespaces é aberto, restaura o agente se necessário. **Não inicia um Codespace que esteja parado** e não substitui `postStartCommand` do devcontainer.
- Um devcontainer versionado **não foi criado** porque não há configuração atual do devcontainer no repositório: substituir sua imagem-base antes de observar o ambiente real poderia destruir ferramentas e acesso ao Docker. Configuração de postStart verdadeira depende de observar o devcontainer efetivo e homologar rebuild com preservação do workspace.
- Workflow `.github/workflows/uppulse-release-gate.yml` realiza TypeScript, testes unitários, política do catálogo público e build em Node 24 sem executar pesquisas pagas, migrations ou deploy.

## Ação única para atualizar o agente instalado (quando operador estiver disponível)
```bash
cd /workspaces/uppulse-homologacao/missao9/codigo || exit 1
git fetch origin feat/uppulse-missao10-supercatalogo && \
git show origin/feat/uppulse-missao10-supercatalogo:scripts/uppulse_bridge_install.sh | bash
```
O comando deverá instalar a versão corrigida e deixar habilitada a recuperação na abertura do terminal. O ChatGPT poderá então enviar Issues `[UPPULSE-AGENT] DIAGNOSTICO`, `[UPPULSE-AGENT] CATALOGO` (SQL fixo só de contagem) e novamente PREVIEW/VALIDAR, obtendo códigos precisos.

## Dados comerciais
- Referência histórica em `docs/ESTADO_OPERACIONAL.md` em 2026-11-10: 32.707 produtos, 96.851 ofertas, 16.945 linhas na projeção `catalog_search_products` do PostgreSQL `uppulse_catalog`, contêiner `beupfree-catalog-pg17`. **Não são contagens verificadas hoje**; consulta futura `CATALOGO` reconfirmará.
- O catálogo multi-marketplace já possui integrações/código para FutFanatics/AWIN e Dafiti; política operacional exige descontos válidos e distinção Produto ≠ Oferta.
- **Novos produtos:** primeiro medir atualização e elegibilidade de feeds, fazer importação/staging e auditoria offline, obter autorização antes de qualquer escrita massiva ou inclusão em catálogo publicado. Não reexecutar pesquisas pagas da Ficha.
- **Novos clientes:** aquisição e divulgação devem entrar após oferta disponível e experiência de compra/links afiliados testados; não disparar mensagens para contatos obtidos de grupos sem consentimento.

## Gate de lançamento Hostinger
1. Validar no GitHub o SHA exato da release, teste unitário, política de elegibilidade, build e smoke de preview real (banco, filtros, fotos, desconto, links afiliados e sessão).
2. Conferir destino real do banco **de produção**. O PostgreSQL no Docker do Codespaces não pode ser tratado como persistência de produção; verificar host acessível pela Hostinger, volume, migração aditiva aprovada e backup com restauração testada. Não copiar senhas/dumps pelo GitHub.
3. Obter acesso autorizado à Hostinger Business, confirmar configuração Node.js e `uppulse.beupfree.com.br`, TLS, DNS, variáveis de ambiente no painel (`DATABASE_URL`, `SESSION_SECRET`, flags reais) e processos. Não presumir que a documentação histórica Supabase corresponda ao banco atual.
4. Validar modo operacional `PUBLIC_DEMO_MODE=false`, catálogo elegível de descontos, links afiliados, metadados/canonical, funcionamento mobile e retorno HTTP/HTTPS; testar login/privacidade quando aplicáveis.
5. Preparar release de código de branch homologada para branch de produção mediante autorização; evitar `force push` e não publicar automaticamente. Abrir tráfego e iniciar aquisição somente após smoke do domínio público.

**Bloqueadores atuais:** preview 5011 não confirmado, gate de build não confirmado, reinício automático após rebuild não homologado, acesso/credenciais Hostinger e banco de produção não disponíveis por esta ponte. Nenhum deploy de produção foi executado.
