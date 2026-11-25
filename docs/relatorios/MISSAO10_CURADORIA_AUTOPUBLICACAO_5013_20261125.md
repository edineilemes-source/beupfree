# Missão 10 — Publicação automática via Curadoria, homologação 5013
**Data:** 25/11/2026  
**Fonte:** branch `feat/uppulse-curadoria-publicacao-automatica-20261125` (a integrar à branch canônica após testes).
**Objetivo:** ninguém deve precisar abrir uma Issue, executar Python ou manipular SQL para publicar novos tênis aceitos através da Curadoria.

## Comportamento implementado
1. Usuário abre **Curadoria → Feeds de parceiros** na porta **5013**, escolhe o `.csv.gz` AWIN e clica em **Enviar e validar produtos**.
2. O frontend identifica parceiro/feed diretamente no arquivo, chama `POST /api/admin/awin-feeds/upload`, exibe totais/revisões; a própria página chama `POST /api/admin/awin-feeds/process` para incorporar **somente** `IN_SCOPE_CONFIRMED` em staging.
3. Depois de completar o importador, **o backend**, não um GitHub Issue, cria automaticamente um trabalho idempotente baseado em `merchant + feedId + sha256`. Ele só aceita o **Codespaces privado de homologação 5013**, `uppulse_catalog` em `127.0.0.1:5436`, `NODE_ENV=development`, sem `PUBLIC_DEMO_MODE` e com a aprovação existente do catálogo. Ambientes de produção ou outras portas nunca habilitam a operação.
4. `scripts/awin-curadoria-publish-worker.py` é iniciado em processo separado; o navegador pode fechar. O worker reconfere SHA-256 do arquivo salvo e a auditoria do upload, chama o **mesmo motor multiempresa** `scripts/awin-partner-onboard.py`, que protege o clone, executa pré-validação, backup integral + restauração testada, schema, Produto Mestre histórico, evidências de desconto/0%, classificação, normalização, projeção e auditoria de isolamento.
5. A esteira grava o estado restrito por parceiro/feed/hash em `~/.local/share/uppulse/curator-publications/`. A UI consulta `GET /api/admin/awin-feeds/publication/:merchant/:feedId/:sha256` e distingue `QUEUED`, `RUNNING`, `COMPLETED` e `BLOCKED`. Somente em `COMPLETED` mostra a contagem de produtos visíveis e link para a vitrine.
6. Reenvio idêntico e múltiplos cliques **não duplicam** jobs, nem contornam a trava histórica do pipeline. Se a loja já foi processada anteriormente (ex.: Clovis pelo agente), o motor emite `ALREADY_ONBOARDED`; o worker confere novamente as linhas elegíveis e disponíveis na busca do **clone**, sem anunciar uma nova importação.
7. A publicação automática ocorre **exclusivamente no catálogo de homologação**, jamais na Hostinger. Fora de escopo/quarentena não são indexados. Produtos a preço regular continuam elegíveis com 0% sem anúncio promocional falso.

## Por que antes a Clovis não aparecia após o upload
A rota antiga `/process` encerrava com `STAGED_IN_DATABASE` e `published:0`, sem sequer chamar a etapa comercial. Para a Clovis AWIN **107702**, feed **98680**, foram analisados 8.198 registros, com 2.846 aceitos, 3.654 fora de escopo e 1.698 em revisão. A entrada anterior via Issue #106 confirmou 2.846 produtos disponíveis e 20.604 linhas totais na projeção, **mas esse sucesso não demonstrava que o botão da Curadoria publicava**. A presente mudança corrige o acionamento a partir do próprio botão.

## Testes e condições
- `server/curationSources/autoPublication.test.ts`: bloqueio fora da 5013/clone, identificação SHA, fila idempotente, falha de spawn, compatibilidade da ponte v1.3.6.
- Pipeline Python: `python3 -m py_compile scripts/awin-curadoria-publish-worker.py`.
- Workflow `.github/workflows/uppulse-curadoria-auto.yml`: `npm run check`, `npm run test:unit`, `npm run build`.
- **Homologação real pendente:** iniciar preview do novo SHA na 5013 e reenviar o feed original da Clovis **na interface**, observar `ALREADY_ONBOARDED` com contagem de produtos visíveis. Depois testar com parceiro novo: `AWIN_PARTNER_CATALOG_READY`. Não executar importações manuais no banco.
- **Operação segura:** se o Codespaces estiver pausado, a UI não executa; se o GitHub estiver indisponível, o pipeline pode bloquear antes de gravar. Não reiniciar/excluir PostgreSQL nem restaurar backup sem diagnóstico.

## Arquivos
- `server/curationSources/autoPublication.ts`, `server/curationSources/autoPublication.test.ts`: verificação de clone, fila e status.
- `scripts/awin-curadoria-publish-worker.py`: executor desacoplado, invoca motor existente.
- `server/curationSources/awinFeedUpload.ts`: aciona pipeline no servidor após importação e fornece status.
- `client/src/pages/AwinFeedUpload.tsx`: progresso e link da loja no catálogo.
- `scripts/uppulse_codespace_agent.py`: versão 1.3.7 fornece aprovação explícita/commit SHA ao iniciar previews futuros; o perfil seguro 5013 já existente da versão 1.3.6 também funciona sem atualização.
- `package.json` e workflow: testes registrados.
