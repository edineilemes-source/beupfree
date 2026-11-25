# Missão 10 — Entrada reutilizável de parceiros AWIN (25/11/2026)

## Objetivo e decisão comercial permanente
A experiência bem-sucedida com a Olympikus AWIN 17698/51837 foi incorporada como um fluxo **multiempresa** para novos parceiros. Tênis com preço regular são elegíveis: se não houver preço anterior confiável, conservar a origem sem preço anterior, representar em evidência/projeção `previous_price=current_price`, `discount_percent=0`, `promotion_status=REGULAR_PRICE`. Desconto real somente com evidência; não inferir a partir de `base_price`, RRP ou parcelas. A ordenação decrescente coloca 0% após promoções. Produtos não tênis e não confiáveis permanecem excluídos ou em revisão.

## Fluxo implementado

1. **Receber, auditar, triar e importar para staging**: já existe na Curadoria administrativa AWIN, em `POST /upload` e `POST /process` do módulo `server/curationSources/awinFeedUpload.ts`. A upload conserva arquivo original com SHA256; o processamento importa somente candidatos classificados `IN_SCOPE_CONFIRMED`, sem disponibilizar automaticamente produtos na vitrine. O novo executor só prossegue após esta etapa ter realmente criado os raw items, offers, variants e identidades no banco.
2. **Execução automatizada após staging**: `scripts/awin-partner-onboard.py` recebe exclusivamente dois identificadores numéricos AWIN (`--merchant`, `--feed-id`) e exige `--apply-to-audited-clone`. Descobre contagens a partir do banco, verifica a fingerprint real, limita o escopo à instância auditada `beupfree-catalog-pg17-audit` em 127.0.0.1:5436, trava execuções concorrentes e prepara snapshot imutável do GitHub sem modificar o checkout local.
3. **Pré-validação sem gravação**: `scripts/awin-regular-catalog-stage.ts` com IDs e contagens obtidos da base deve comprovar vínculo 1:1 de itens importados, preço, produto, estoque, links, classificação e escopo. Requer ao menos um produto elegível e evidência comercial consistente. Produtos fora do escopo/revisão não são indexados.
4. **Backup/restauração verificada ANTES de qualquer escrita comercial**: `pg_dump -Fc`, verificação do arquivo e restauração integral em banco temporário novo, com comparação de contagens. Backup preservado fora do Git, permissões restritas. Não usa volumes originais.
5. **Migrações de compatibilidade**: valida ou aplica somente quando ainda ausentes `0014_regular_price_offer_evidence.sql` e `0013_master_identity_sidecar.sql`, sempre depois da restauração testada. Schema parcial ou divergente bloqueia.
6. **Produto Mestre**: `scripts/awin-partner-master.ts` reutiliza o parser, matcher e persistência históricos `persistIdentities`; isola novo lojista, exige cobertura completa, impede reprocessamento parcial e preserva memberships de outros lojistas. **A equivalência entre lojas previamente existentes não é assumida**: a reconciliação cruzada permanece procedimento auditável separado, evitando mesclagens falsas.
7. **Preço e normalização**: chama os componentes existentes de `scripts/awin-regular-catalog-stage.ts`, registrando estado promocional/regular, classificações e variantes. Descontos de 0% são aceitos sem criar promoções artificiais.
8. **Projeção/visibilidade**: `scripts/catalog-search-projection-persist.ts`, com versões importadas dinamicamente de `scripts/awin-partner-versions.ts`, gera somente a quantidade de produtos elegíveis. Confirma visibilidade real e verifica a impressão digital da projeção dos demais lojistas.
9. **Relatório**: `AWIN_PARTNER_CATALOG_READY` com quantidades, indicadores de quarentena, backup e versão; `AWIN_PARTNER_BLOCKED` diante de anomalia. Nenhum deploy de produção ou Hostinger é efetuado.

## Como iniciar parceiros futuros

Fluxo recomendado no Codespaces: abrir **Curadoria → upload AWIN → Processar aceitos (staging)**. Após isso, acionar uma única vez o agente GitHub, já autenticado como proprietário do repositório:

- Título da Issue: `[UPPULSE-AGENT] INTEGRAR_AWIN`
- Corpo JSON: `{"merchant":"<id_numérico_AWIN>","feedId":"<id_numérico_feed>"}`

O agente `scripts/uppulse_codespace_agent.py` versão 1.3.6 aceita **somente esses dois campos**, somente Issues criadas pelo proprietário, valida o snapshot do GitHub e executa o pipeline na base auditada, sem aceitar comandos arbitrários. O assistente pode abrir a Issue pelo conector GitHub ao receber o resultado de staging. A reinstalação **uma única vez** da nova ponte `scripts/uppulse_bridge_install.sh` é necessária para o Codespaces carregar o comando `INTEGRAR_AWIN`. Outras ações do agente e previews ficam disponíveis.

Alternativa para execução local controlada (somente após staging):
```bash
cd /workspaces/uppulse-homologacao/missao9/codigo
git fetch origin feat/uppulse-missao10-supercatalogo
git show FETCH_HEAD:scripts/awin-partner-onboard.py | python3 - --merchant=12345 --feed-id=56789 --apply-to-audited-clone
```
Substituir IDs pelos fornecidos pelo novo feed. Não repetir a migração manual da Olympikus; os módulos são reutilizados automaticamente.

## Idempotência e limites conhecidos
- Quando um fornecedor já está integralmente processado no mesmo feed, o executor responde `ALREADY_ONBOARDED` sem repetir gravacões.
- Um **feed novo de um lojista já integrado**, mudanças de preço/estoque e execução interrompida depois de qualquer COMMIT requerem um fluxo incremental próprio (refresh/reconciliação), não um reset/reimportação insegura. Essa situação retorna bloqueio, não publicação fictícia.
- Uma fonte que não tenha sido recebida/processada na Curadoria não é importada automaticamente pelo novo executor; o upload/staging administrativo permanece a primeira etapa.
- Não há deploy de produção, integração Hostinger ou homologação visual automaticamente embutidos na liberação comercial. A ação PREVIEW permanece separada.
- Os scripts conservam a fingerprint **desta** cópia auditada; na migração para outra infraestrutura, a identidade e política do novo banco deverão ser configuradas e auditadas, nunca presumidas.
- Não foi implementado merge automático entre produtos mestres já cadastrados de lojas distintas: equivalência exige prova e curadoria.
- Pipeline de ingestão/primeira publicação do lojista é automatizado **a partir do staging**. Uma integração futura poderá ligar o clique administrativo ao acionamento sem Issues, mas a versão de homologação atual mantém a exigência de uma Issue autenticada para gravações protegidas.

## Arquivos
- Novos: `scripts/awin-partner-onboard.py`, `scripts/awin-partner-master.ts`, `scripts/awin-partner-versions.ts`, `scripts/awin-partner-onboard.test.ts`.
- Alterados: `scripts/uppulse_codespace_agent.py`, `scripts/uppulse_bridge_install.sh`, `package.json`.
- Reutilizados: `server/curationSources/awinFeedUpload.ts`, `server/integrations/awin/catalogCandidate.ts`, `server/integrations/awin/regularPriceEvidence.ts`, `scripts/awin-regular-catalog-stage.ts`, `scripts/catalog-search-projection-persist.ts`, migrações 0013/0014 e motor histórico do Produto Mestre.

## Estado de validação
- Código publicado na branch `feat/uppulse-missao10-supercatalogo` via conector GitHub. Verificações de TypeScript e testes são executadas em snapshot do agente e no Release Gate (sem deploy), consultar Issues #100, #101, #102 e workflows associados para resultado exato.
- **Não foi executado onboarding de um novo fornecedor real** com esta versão genérica; a homologação efetiva em banco da Olympikus ocorreu com o executor específico anterior e não comprova automaticamente todos os caminhos de novos feeds.
- Nenhuma alteração adicional em banco foi realizada nesta implementação genérica.
