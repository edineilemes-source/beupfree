# Curadoria privada Awin

## Segurança e arquitetura

O projeto possui autenticação de clientes, mas a sessão não carrega papel administrativo. `admin_users` não está ligada ao login. Por isso AWIN005 deliberadamente não registra rota HTTP nem UI: proteger uma rota apenas com “usuário autenticado” daria acesso de curadoria a qualquer cliente.

O preview inicial é uma CLI read-only que exige `AWIN_CURATOR_DATABASE_URL` explícita e nunca usa `DATABASE_URL` implicitamente:

```bash
AWIN_CURATOR_DATABASE_URL=postgresql://... npm run awin:curation -- quality
AWIN_CURATOR_DATABASE_URL=postgresql://... npm run awin:curation -- preview \
  --merchant='Lauri Esporte' --brand='New Balance' --search='520' \
  --min-price=500 --max-price=1500 --has-description=true --has-gtin=true \
  --min-variants=2 --available=true --state=staging --limit=20
```

O serviço retorna Product, Provider, Merchant, Feed, descrição original, imagens, Variants, tamanho, cor, GTIN, Offers, preço, moeda, estoque, disponibilidade dos links, publication state e proveniência. URLs afiliadas/merchant não são retornadas pela consulta; aparecem somente como booleanos de disponibilidade. A CLI não modifica dados.

Uma UI futura exige antes: papel administrativo persistente ligado a `users`, middleware server-side que revalide usuário ativo e papel, testes 401/403 e auditoria das ações. Não basta esconder a rota no React.

## Qualidade e promoção

`quality` diagnostica descriptions, imagens, Variants, Offers e duplicatas possíveis sem modificar ou mesclar dados. Repetição de nome/descrição é apenas sinal para revisão.

Classificação promocional determinística:

- `PROMOTION_CONFIRMED`: preço atual menor que old/RRP válido, `saving > 0` ou `savings_percent > 0`.
- `NOT_PROMOTIONAL`: campos estruturados presentes demonstram economia zero/negativa ou preço atual não inferior ao regular.
- `PROMOTION_UNCERTAIN`: ausência de evidência estruturada confiável.

Nome, descrição, presença no feed, preço aparentemente baixo, fonte externa ou IA nunca confirmam promoção. Somente Products com pelo menos uma Offer `PROMOTION_CONFIRMED` poderão futuramente entrar numa proposta de publicação.

## Workflow proposto — não executado

```text
draft -> reviewed -> approved -> published -> paused -> archived
```

O schema atual cobre Product `draft/published/archived`, external identity `staging/approved/rejected` e Offer `active/paused/expired/removed`, mas não registra toda a trilha de revisão. Antes de implementar transições será necessária uma migration aditiva separada com estado de revisão, timestamps, ator e motivo. AWIN005 não cria nem aplica essa migration e não promove nenhum registro.

## Performance

O caminho inicial agora:

- carrega hashes raw e identities existentes;
- resolve cada Merchant uma vez por import;
- reutiliza identities em memória por Product/Merchant;
- deduplica imagens dentro do lote;
- persiste imagens e raw com `jsonb_to_recordset` em bulk;
- mantém Product/Variant/Offer constraints, transação única e fast path `unchanged`.

No PostgreSQL 16 temporário com o feed real: primeira carga em 3,300 s (458,79 linhas/s; RSS 169.480 KB) e reimport em 0,154 s (9.808,28 linhas/s; RSS 113.420 KB). Os round-trips estimados caíram de aproximadamente 14.301 para 4.008 (−72%). O resultado local não é comparação direta com a rede/pooler Supabase. No Supabase já populado, o reimport idêntico levou 2,702 s e retornou 1514 `unchanged`.

O restante dos round-trips iniciais está em Product/identity/Variant/Offer; uma próxima otimização pode bulk-upsert essas entidades usando tabela temporária ou staging CTE, depois de testes equivalentes.
