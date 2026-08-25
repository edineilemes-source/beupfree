# DAFITI003 — curadoria read-only do catálogo Dafiti

## Segurança e execução

A curadoria não persiste classificações. A CLI exige explicitamente
`AWIN_CURATOR_DATABASE_URL`, abre `BEGIN READ ONLY` com isolamento repeatable
read e não consulta `DATABASE_URL`. Nenhuma rota HTTP foi adicionada.

```bash
npm run awin:dafiti-curation -- summary
npm run awin:dafiti-curation -- brands
npm run awin:dafiti-curation -- discounts
npm run awin:dafiti-curation -- prices
npm run awin:dafiti-curation -- sizes
npm run awin:dafiti-curation -- review
```

O ambiente local auditado em 24 de agosto de 2026 não possuía a variável
curator. Por isso, as distribuições reais permanecem pendentes e não foram
substituídas por fixtures ou por acesso com a credencial de escrita.

## Taxonomia

A ordem das evidências é: taxonomia Dafiti/Awin, atributos estruturados, nome e
descrição apenas complementar. Os escopos são `RUNNING`, `TRAINING`, `WALKING`,
`PERFORMANCE_OTHER`, `SPORTSWEAR`, `LIFESTYLE`, `SKATE`, `FOOTBALL`, `FUTSAL`,
`BASKETBALL`, `TENNIS_COURT`, `OTHER_SPORT`, `UNCERTAIN` e
`EXCLUDED_NON_SNEAKER`. Cada resultado traz evidência e confiança; nenhum
esporte é inventado quando só existe o sinal genérico de tênis.

Público é classificado como `MASCULINO`, `FEMININO`, `UNISSEX`, `INFANTIL` ou
`UNKNOWN` somente por sinais semânticos. Cor nunca determina gênero.

## Elegibilidade e reason codes

Um Product é tecnicamente elegível se pelo menos uma Variant/Offer possui tênis
no escopo, promoção matematicamente consistente (`old > current > 0`), estoque,
deeplink Awin, URL merchant, imagem, marca, título, tamanho, BRL e identidades
sem colisão conhecida. GTIN e descrição não são gates para Dafiti. Marca vazia
é falha de dados; reputação ou desconhecimento da marca não são gates.

Estados read-only:

- `ELIGIBLE`: todos os mínimos atendidos e nenhuma revisão detectada.
- `NEEDS_REVIEW`: `uncertain_scope`, `suspicious_size`, `identity_warning`,
  `extreme_discount_inconsistent` ou `multiple_price_policy_required`.
- `INELIGIBLE`: `non_sneaker`, `promotion_not_confirmed`, `out_of_stock`,
  `missing_affiliate_url`, `missing_merchant_url`, `missing_image`,
  `missing_brand`, `missing_title`, `missing_size` ou `non_brl`.

Desconto não recebe corte editorial. A CLI calcula cenários de 5%, 10%, 15%,
20%, 25%, 30%, 40%, 50%, 60% e 70%, além de preço, marcas e volumes. Descontos
de 50% ou mais são `EXTREME_BUT_CONSISTENT` quando a matemática fecha; caso
contrário vão para revisão, sem acusação de fraude.

## Decisões pendentes e riscos

- Definir a política de card para `SINGLE_PRICE`, `MULTIPLE_CURRENT_PRICES`,
  `MULTIPLE_OLD_PRICES` e `MULTIPLE_DISCOUNTS` (`R$ X`, “a partir de” ou “até
  Y% OFF”).
- Definir normalização futura de tamanho preservando raw, faixa e valor
  normalizado; nenhum valor é corrigido nesta missão.
- Preservar `rawColour` e acrescentar futuramente `normalizedColour` e
  `colourFamily`, sem sobrescrever origem.
- Revisar candidatos a duplicidade; nome, marca, descrição ou imagem iguais não
  autorizam merge sem GTIN.
- A ausência de `AWIN_CURATOR_DATABASE_URL` impede concluir as métricas reais e
  o baseline antes/depois. Até a execução real, a recomendação é `NOT_READY`.
