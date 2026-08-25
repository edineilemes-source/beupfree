# DAFITI004 — taxonomia hierárquica read-only

O classificador `uppulse-taxonomy-v1` separa pertencimento ao universo, intenção,
atividades, confiança e elegibilidade comercial. O motor em
`productTaxonomy.ts` não conhece merchants. O script Dafiti apenas adapta os
campos raw do feed e executa a classificação em memória.

## Hierarquia

- Universe: `SNEAKER_CONFIRMED`, `SNEAKER_PROBABLE`, `NON_SNEAKER`,
  `UNRESOLVED`.
- Style: `PERFORMANCE`, `SPORTSWEAR`, `LIFESTYLE`, `HYBRID`, `UNKNOWN`.
- Activities: `RUNNING`, `WALKING`, `TRAINING`, `FOOTBALL`, `FUTSAL`,
  `BASKETBALL`, `TENNIS_COURT`, `VOLLEYBALL`, `SKATE`, `TRAIL`,
  `OTHER_SPORT`, `GENERAL`, `UNKNOWN`.
- Confidence: `HIGH`, `MEDIUM`, `LOW`, sempre determinística e acompanhada de
  reason codes.

Style e activity não são gates. Um tênis legítimo pode ser lifestyle/general e
permanecer elegível. Marca nunca é evidência suficiente e não há whitelist.
Sinais negativos inequívocos no título prevalecem sobre categoria de feed
incorreta; kits que misturam tênis e outro item exigem revisão.

## Segurança e execução

As CLIs exigem `AWIN_CURATOR_DATABASE_URL`, iniciam
`BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` e terminam com
`ROLLBACK`. Não há persistência, rota HTTP, collector ou scheduler.

```bash
npm run awin:dafiti-taxonomy-audit -- compact
npm run awin:dafiti-taxonomy-audit -- brands
npm run awin:dafiti-taxonomy-audit -- samples
```

## Persistência futura proposta — não aplicada

Uma futura tabela append-only `product_taxonomy_classifications` poderia conter
`product_id`, `universe`, `style`, `activities[]`, `confidence`,
`reason_codes[]`, `classifier_version`, `classified_at` e `source_evidence`
JSONB. A chave lógica deve permitir múltiplas versões por Product, sem
sobrescrever raw. Uma view poderia selecionar a versão vigente. Decisões de
publicação e ranking devem permanecer fora dessa tabela para preservar
reversibilidade e auditoria.

