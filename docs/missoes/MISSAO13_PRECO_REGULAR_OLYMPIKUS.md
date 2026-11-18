# Missão 13 — Preço regular e comparação multi-loja (UpPulse V1)

Decisão do produto: **ofertas com preço atual válido podem participar do catálogo mesmo sem desconto**, desde que a origem comercial esteja aprovada e que todas as verificações de segurança/qualidade sejam satisfeitas. Não inventar promoções, preço histórico ou economia.

## Estados de oferta
- `PROMOTION_CONFIRMED`: preço anterior verificável, maior que preço atual; percentual calculado e validado.
- `REGULAR_PRICE`: preço atual positivo em BRL, preço histórico **não fornecido** (ou ausência de comprovação de desconto). Guardar `promotionStatus=REGULAR_PRICE` e a proveniência dessa ausência. Para compatibilidade da projeção legada `previousPrice=currentPrice` e `discountPercent=0`; a interface deve mostrar **somente o preço atual** sem tachado e sem selo de promoção.
- Outros estados, preços inválidos, moeda diferente, sem estoque, sem imagem, sem link afiliado ou com dados desatualizados continuam bloqueados.

## Código já aplicado
- `server/publicCatalog/policy.ts`: aceita explicitamente `REGULAR_PRICE` e preserva a regra anterior para promoções; rejeita estados comerciais desconhecidos.
- `server/catalogSearchProjection/builder.ts`: aceita `REGULAR_PRICE` com desconto zero sem suplantar promoções confirmadas na seleção da oferta representativa.
- `server/integrations/awin/normalize.ts`: lê `Fashion:size` se o campo AWIN padrão `size_stock_amount` estiver vazio; preferência preservada para formato antigo.
- Testes específicos adicionados a `policy.test.ts`, `builder.test.ts` e `awin.test.ts`.

## Inventário do arquivo do usuário — Olympikus BR
Arquivo original analisado localmente: `17698-51837-pt_BR-Default.csv.gz`, **não versionado no GitHub**, sem credenciais.
- 7.140 linhas, todas com `merchant_id=17698`, `currency=BRL`, preço atual e link AWIN.
- 7.139 registros com `Fashion:size`; `size_stock_amount` vazio em todos.
- 7.042 `product_GTIN` não vazios, todos com dígito verificador estruturalmente válido (checagem GTIN-8/12/13/14 no arquivo recebido).
- 5.127 títulos começam com `Tênis`; a elegibilidade total e números de modelos devem vir do classificador, não dessa contagem simplificada.
- Campos `product_price_old`, `rrp_price`, `saving`, `savings_percent` não preenchidos nos 7.140 registros.
- 5.127 linhas com nome iniciando em `Tênis `, todas com tamanho numérico e imagem/link afiliado. 802 URLs comerciais distintas nesses itens. Classificador ainda deverá decidir sobre kits e ambiguidades.
- `last_updated` está vazio em todos os registros: a importação não pode ser confundida com comprovação de atualização recente no anunciante.
- Não há aprovação implícita de importação, publicação ou fusão de identidades.

## Estado técnico verificado no GitHub
- **Implementado e testado**: `evaluateCommercialPrice` para `PROMOTION_CONFIRMED`, `REGULAR_PRICE`, `REVIEW_REQUIRED`; aceite na taxonomia sem liberar outros requisitos; projeção com status explícito; API sem exibir preço anterior fictício; filtro `Sem desconto`; tamanho AWIN `Fashion:size`; testes de três lojas para preço/desconto.
- **Migration versionada, NÃO aplicada**: `migrations/0014_regular_price_offer_evidence.sql` flexibiliza apenas as constraints necessárias e mantém a distinção por `promotion_status`. Exige confirmação de cópia de segurança e schema real.
- **Auditor AWIN em modo somente leitura**: `scripts/awin-commercial-audit.ts`, parametrizado para qualquer merchant/feed, sem consultas pagas, sem conexão com banco e sem imprimir links ou tokens. Deve ser executado sobre o arquivo real dentro do Codespaces para medir classificação efetiva do código.
- **Release gate**: GitHub Actions validou TypeScript, testes, política pública e build no commit `7961fb8e4b73e704562a77f12c4dd45f1a9e0772`.
- **Não homologado em DB/navegador**: gravação de evidências regulares, processamento staging, classificação multi-merchant, regeneração real da projeção e comparação real do Produto Mestre.

## Pendências críticas antes de importar/publicar
1. Preparar **pipeline persistente genérico e multi-merchant** de evidências de preço e classificação, para feed novo com `REGULAR_PRICE`: a migração e o builder estão prontos, mas `awin-dafiti-catalog-persist.ts` ainda é específico para Dafiti e não deve ser reaproveitado indiscriminadamente. Validar constraints reais antes de qualquer migração.
2. Conservar o valor original de preço anterior ausente na camada raw/proveniência. `previousPrice=currentPrice` somente como compatibilidade interna e nunca como evidência de desconto real.
3. Adaptar exibição de desconto zero em cards/filtros e testes; ordenar por menor preço independentemente de promoção; nas ordenações por desconto, REGULAR_PRICE vem por último.
4. Auditar taxas de deduplicação e vínculo do Produto Mestre *por modelo e variante*. Confrontar GTIN, modelo e atributos; não fundir automaticamente produtos ambíguos.
5. Validar o feed real com o importador em modo `dry-run` e saída saneada, e depois testar em staging isolado com backup e plano de rollback. **Não alterar o baseline Dafiti/FutFanatics antes da homologação**.
6. Liberar produção apenas após gate, testes em navegador, atualização de banco de produção/backup e smoke de Hostinger em data posterior.

## Restrições
- Preservar GitHub como fonte canônica; não reiniciar a porta 5013 sem novo gate aprovado e instrução explícita.
- Não modificar, truncar, sincronizar ou recriar o PostgreSQL já recuperado.
- Sem deploy para Hostinger, sem pesquisas externas pagas, sem exposição de segredos AWIN.
