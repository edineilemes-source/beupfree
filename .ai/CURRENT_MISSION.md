# Missão atual
```yaml
mission_id: UPCAT003
title: "Homologação ponta a ponta do catálogo operacional"
status: BLOCKED
expected_branch: upcat003-homologation
objective: "Homologar de forma controlada e não produtiva o caminho do catálogo operacional preparado na UPCAT002, cobrindo lista pública operacional, detalhe de produto, clique afiliado, elegibilidade/expiração e rollback para catálogo demo, corrigindo apenas defeitos necessários à homologação e mantendo todos os gates de produção fechados."
context:
  - "UPCAT002 foi integrada em codespace-working no commit 0ea24d5 e criou uma transição reversível entre catálogo demo e projeção operacional."
  - "O catálogo operacional só pode ser selecionado com UPPULSE_PUBLIC_CATALOG_SOURCE=operational, UPPULSE_PUBLIC_CATALOG_APPROVED=true e AWIN_CURATOR_DATABASE_URL."
  - "O default permanece demo e nenhum catálogo Dafiti foi publicado em produção."
  - "A projeção catalog_search_products é multi-merchant e deve preservar Product separado de Offer/merchant."
  - "O ranking recommended é multi-sinal e desconto isolado não deve dominar o padrão."
  - "Esta missão é homologação local/Codespaces; não autoriza Hostinger, DNS, main ou publicação para usuários reais."
allowed_actions:
  - "Ler AGENTS.md, arquivos .ai, documentação UPCAT002 e código necessário à homologação."
  - "Usar a credencial AWIN_CURATOR_DATABASE_URL já autorizada no ambiente, sem imprimir, copiar ou persistir seu valor."
  - "Iniciar/reutilizar o serviço local do Codespace conforme AGENTS.md e testar endpoints somente no ambiente local/homologação."
  - "Ativar temporariamente no processo local de homologação UPPULSE_PUBLIC_CATALOG_SOURCE=operational e UPPULSE_PUBLIC_CATALOG_APPROVED=true, sem persistir essas flags em produção."
  - "Validar lista do catálogo operacional, filtros/ranking relevantes, detalhe do produto e fluxo de clique/URL afiliada sem realizar compra."
  - "Validar política de elegibilidade, pausa/expiração/refresh por testes e/ou fixtures seguras, sem destruir dados reais."
  - "Validar rollback removendo/desativando o gate operacional local e comprovando retorno ao catálogo demo."
  - "Corrigir código, testes ou documentação somente se necessário para fechar defeitos encontrados nesta homologação."
  - "Executar testes, typecheck, build, git diff --check e registrar evidências sanitizadas no CODEX_REPORT."
  - "Atualizar arquivos .ai conforme o protocolo."
forbidden_actions:
  - "Fazer deploy na Hostinger ou qualquer ambiente de produção."
  - "Alterar DNS, domínio público, variáveis ou configuração externa de produção."
  - "Fazer merge na main, alterar main, force push ou reset destrutivo."
  - "Publicar/ativar catálogo Dafiti para usuários reais."
  - "Executar compra, pedido ou qualquer transação comercial real durante teste de clique afiliado."
  - "Imprimir, registrar, transmitir ou versionar AWIN_CURATOR_DATABASE_URL, tokens, .env ou qualquer segredo."
  - "Executar migração destrutiva, apagar ou modificar em massa dados operacionais para simular expiração/pausa."
  - "Acoplar domínio público diretamente à Dafiti ou violar Product != Offer."
acceptance_criteria:
  - "Com gates locais autorizados, GET /api/products retorna catálogo operacional real da projeção e não os demos, com evidência sanitizada de contagem/amostra sem dados sensíveis."
  - "O detalhe de ao menos um produto retornado pela lista funciona ponta a ponta no ambiente de homologação."
  - "O clique/URL afiliada do produto homologado é gerado/resolvido corretamente até o destino esperado sem efetuar compra e sem expor credenciais."
  - "O ranking recommended continua determinístico e multi-sinal; filtros permanecem semanticamente separados da ordenação."
  - "Elegibilidade e estados DRAFT/PUBLISHED/PAUSED/EXPIRED, incluindo expiração/refresh, são comprovados por testes seguros sem mutação destrutiva de dados reais."
  - "Após retirar/desativar o gate operacional local, /api/products volta ao catálogo demo, comprovando rollback reversível."
  - "Nenhuma flag de produção, deploy, DNS, main ou publicação real é alterada."
  - "Testes relevantes, npm run check, npm run build e git diff --check passam, ou limitações reais do ambiente são documentadas precisamente."
  - "CODEX_REPORT separa claramente evidências homologadas, eventuais correções realizadas e o gate humano ainda necessário antes de produção."
validation_commands:
  - "npm test"
  - "npm run check"
  - "npm run build"
  - "git diff --check"
  - "git status --short"
```
