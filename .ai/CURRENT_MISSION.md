# Missão atual
```yaml
mission_id: UPCAT002
title: "Transição controlada do catálogo Dafiti para o catálogo público"
status: COMPLETED
expected_branch: devai001-agent-workflow
objective: "Preparar a transição arquitetural do UpPulse do catálogo público demo para o catálogo operacional real da Dafiti, definindo e implementando de forma controlada elegibilidade pública, ranking padrão e governança de publicação/pausa/atualização/expiração, sem realizar deploy, merge na main ou publicação real em produção nesta missão."
context:
  - "A projeção catalog_search_products possui aproximadamente 11.424 produtos Dafiti elegíveis e permanece separada do catálogo público atual."
  - "O endpoint público /api/products ainda usa aproximadamente 508 produtos demo; Dafiti permanece invisível ao público."
  - "A preview Dafiti já existe sob flag e rota de desenvolvimento, sem publicação pública automática."
  - "O produto deve permanecer multi-marketplace: Product é diferente de Offer e regras específicas de parceiros devem ficar atrás de adapters/camadas apropriadas."
  - "Ordenar literalmente pelo maior desconto não deve ser o ranking público padrão, pois pode privilegiar marcas pouco relevantes apenas pelo percentual promocional."
  - "A transição deve ser reversível e governada, preservando gates humanos para publicação real e produção."
allowed_actions:
  - "Inspecionar arquitetura, APIs, catálogo demo, projeção catalog_search_products, adapters, flags, testes e documentação necessários à UPCAT002."
  - "Projetar e implementar a camada de seleção do catálogo público real sem acoplar o domínio à Dafiti."
  - "Definir estados e regras explícitas para elegibilidade, publicação, pausa, atualização e expiração de ofertas/produtos, reutilizando estruturas existentes quando adequado."
  - "Implementar ranking público padrão determinístico e multi-sinal que não use maior desconto como único critério dominante."
  - "Preparar aposentadoria controlada do catálogo demo, preferencialmente por flag/configuração reversível até autorização de publicação real."
  - "Criar ou ajustar testes automatizados e documentação técnica necessários."
  - "Executar testes, check, build e validações locais não destrutivas."
  - "Atualizar os arquivos .ai conforme o protocolo ao concluir."
forbidden_actions:
  - "Fazer deploy na Hostinger ou em qualquer ambiente de produção."
  - "Alterar DNS, domínio público ou configuração externa de produção."
  - "Fazer merge ou alteração da main, force push ou reset destrutivo."
  - "Ativar/publicar o catálogo Dafiti para usuários reais sem novo gate humano explícito."
  - "Executar migração destrutiva, apagar dados ou remover irreversivelmente o catálogo demo."
  - "Expor segredos, tokens, DATABASE_URL, .env ou credenciais."
  - "Acoplar Product diretamente a Dafiti ou introduzir arquitetura que impeça futuros marketplaces."
acceptance_criteria:
  - "Existe caminho explícito e reversível entre catálogo demo e catálogo real, com default seguro que não publica Dafiti automaticamente em produção."
  - "A seleção pública consome uma abstração multi-marketplace adequada e mantém Product separado de Offer."
  - "As regras de elegibilidade e ciclo de vida de publicação/pausa/atualização/expiração estão explícitas no código e/ou documentação e cobertas por testes relevantes."
  - "O ranking padrão combina sinais de relevância/qualidade/completude/oferta de forma determinística; desconto isolado não domina o ranking por padrão."
  - "Filtros existentes continuam semanticamente separados do ranking/ordenação."
  - "A aposentadoria dos demos é preparada de forma reversível e não é ativada para produção nesta missão."
  - "Nenhum catálogo Dafiti é efetivamente publicado em produção, nenhum deploy é realizado e main permanece intocada."
  - "Testes relevantes, check, build e git diff --check passam ou blockers reais são documentados com precisão."
  - "CODEX_REPORT informa claramente o que foi implementado, o que permanece atrás de gate e qual autorização humana será necessária para a publicação real."
validation_commands:
  - "npm test"
  - "npm run check"
  - "npm run build"
  - "git diff --check"
  - "git status --short"
```
