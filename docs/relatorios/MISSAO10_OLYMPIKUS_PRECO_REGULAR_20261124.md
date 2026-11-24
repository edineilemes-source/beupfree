# Missão 10 — Olympikus com preço regular e comparação (24/11/2026)

## Decisão de negócio recuperada
Produtos genuinamente de tênis e comercialmente elegíveis podem ser indexados sem promoção. Quando falta preço anterior, manter evidência bruta nula e representar downstream com `previous_price=current_price`, `discount_percent=0` e `promotion_status='REGULAR_PRICE'`. Não confundir RRP/base_price ambíguos com preço anterior. Filtrar por estoque, imagem e link de afiliado; não liberar não-tênis.

## Evidências reais
- Contêiner de homologação, isolado da fonte: `beupfree-catalog-pg17-audit`, `uppulse_catalog`, porta 5436.
- `products=33520`, `offers=102018`, `catalog_search_products=16945` antes do release.
- Olympikus AWIN merchant `17698`, feed `51837`: 5.167 ofertas, 813 produtos e memberships Master, todas as ofertas classificadas como tênis e preço regular no dry-run; 0 evidências e 0 registros de projeção antes do release.
- Migração existente `migrations/0014_regular_price_offer_evidence.sql` NÃO estava aplicada: as quatro checks ainda exigem preço anterior maior que preço corrente e desconto positivo.

## Implementação no GitHub
- Restaurada a elegibilidade original para `REGULAR_PRICE`, desfazendo a exclusão indevida implementada na política promocional exclusiva.
- `scripts/olympikus_promo_preflight.py` agora valida o fluxo regular sem efeitos colaterais.
- `scripts/catalog-search-projection-persist.ts` aceita banco de destino explícito por `CATALOG_SEARCH_PROJECTION_EXPECTED_DATABASE` sem trocar o contrato da persistência.
- `scripts/olympikus_regular_clone_release.py` é um executor operacional APENAS para o clone auditado, exige `--apply-to-audited-clone`, usa snapshot imutável do GitHub, verifica fingerprint e contagens, realiza backup lógico completo com arquivo preservado fora do Git, restaura-o numa base descartável para validar os totais antes de aplicar a migração 0014, processa evidências/classificação/variantes e gera projeção com contagem exata e auditoria final. Falhas bloqueiam etapas posteriores.
- Agente Codespaces atualizado para permitir alteração controlada apenas dos registros de projeção da Olympikus (0 a 813), preservando a contagem dos demais lojistas em 16.945 e a fingerprint do clone; necessita reinstalar o agente atualizado no Codespaces antes de executar o release.

## Status e limites
- Tipagem e testes do código intermediário verificados via Issues #88 (SUCCESS) e #92 (SUCCESS).
- Validação final do snapshot: Issue #93 (ver resultado no GitHub).
- **PUBLICAÇÃO AINDA NÃO EXECUTADA**: script exige execução expressa no terminal do Codespaces; nenhuma migração, backup restaurado ou gravação da Olympikus foi realizada por esta preparação.
- Não realiza deploy na Hostinger ou mudança do banco original; a loja só ficará visível no preview operacional após a projeção de produtos elegíveis. Não declarar release de produção.
