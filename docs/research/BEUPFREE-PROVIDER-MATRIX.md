# Matriz executiva de providers BeUpFree

**Data:** 17/08/2026 — decisão de pesquisa, não parecer jurídico.

## Decisão

**GO COM RESTRIÇÕES.** O BeUpFree pode operar sem scraping. Priorizar redes de afiliados com product feed; não aprofundar CURA003 no modelo HTML/marketplace antes de uma POC de feed real.

## Ranking consolidado

| # | Provider | Tipo | Brasil | Feed | API publisher | Preço/promo | Deeplink | Comparador | Score | Classe | Blocker principal |
|---:|---|---|---|---|---|---|---|---|---:|---|---|
| 1 | Awin | Affiliate network | SIM | SIM | SIM | excelente | SIM | explícito | 92 | A | termos de cache/IA a validar |
| 2 | Rakuten Advertising | Affiliate network | SIM | SIM | SFTP/feed | excelente | SIM | explícito | 87 | A | aprovação por advertiser |
| 3 | Impact.com | Partner platform | PARCIAL | SIM | SIM | excelente | SIM | explícito | 82 | B | operação/pagamento BR |
| 4 | Admitad | Affiliate network | SIM | SIM | SIM | boa | SIM | aparente | 79 | B | comparação/cache não confirmados |
| 5 | CJ | Affiliate network | ? | SIM | SIM | excelente | SIM | aparente | 76 | B | Brasil não confirmado |
| 6 | Booking.com | Marketplace/partner | PARCIAL | NÃO | SIM | contextual | SIM | contratual | 74 | B | managed contract |
| 7 | Amazon Creators API | Marketplace/affiliate | SIM | NÃO | SIM | excelente | SIM | aparente | 72 | B | 10 vendas/30d; cache/quota |
| 8 | Shopee | Marketplace/affiliate | SIM | ? | ? | ? | manual/programa | ? | 47 | não priorizar | API/feed publisher não comprovado |
| 9 | Magalu | Marketplace/affiliate | SIM | não comprovado | seller | seller | programa | ? | 43 | não priorizar | somente API de seller documentada |
| 10 | Mercado Livre | Marketplace/affiliate | SIM | não comprovado | seller | limitada | programa separado | ? | 39 | não priorizar | sem descoberta global/feed oficial |

Score: autorização 20; dados 15; feed/API 15; preço/desconto 10; monetização 10; Brasil 10; escala 10; categorias 5; integração 5. Blockers prevalecem sobre o número.

## Top 5

1. **Awin:** primeira integração; feed/API rico, comparação explícita, múltiplos merchants e monetização.
2. **Rakuten:** segunda integração; full/delta feed, Brasil e comparadores comprovados.
3. **Impact:** ótima tecnologia; confirmar publisher/pagamento Brasil.
4. **Admitad:** Brasil, XML/API, cupons e diversidade; validar comparação/cache.
5. **CJ:** excelente feed/API; só avançar após confirmação comercial Brasil.

## Próximos experimentos

1. Onboarding Awin e acesso autorizado a 2–3 advertisers brasileiros.
2. POC isolada: baixar feed, medir freshness/completude de 100 ofertas e validar deeplink/SubID; não persistir em produção.
3. Repetir com um feed full/delta Rakuten.
4. Validar juridicamente cache de preço/imagem, IA/derived data, comparação e expiração.
5. Só então definir `NormalizedProduct`, `NormalizedOffer`, `Merchant`, `AffiliateProgram` e `TrackingLink`.

Arquitetura-alvo: `Provider → ProviderAccount → Source → SourceDefinition → AcquisitionStrategy → Connector → NormalizedProduct/NormalizedOffer`, distinguindo Network, Marketplace, Merchant, Seller e Advertiser.

Evidências e links oficiais: [documento completo](./BEUPFREE-SOURCE-ECOSYSTEM.md).
