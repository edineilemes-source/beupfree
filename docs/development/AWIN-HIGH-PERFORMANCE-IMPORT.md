# Importação Awin em alta performance

O importador oficial é `scripts/awin-import.ts`, apoiado por `PostgresAwinRepository`. Ele é configurado por provider Awin, merchant observado e feed explícito; não contém regras de Dafiti, Fut Fanatics, Clovis, Olympikus ou Studio Z.

## Diagnóstico e convergência

O importador genérico anterior acumulava `NormalizedAwinItem[]`, carregava todos os hashes existentes e executava `persistItem` sequencialmente. Cada linha nova podia gerar inserts/updates separados de Product, identidade, Variant e Offer. Assim, o custo remoto crescia diretamente com a quantidade de itens.

A primeira carga Dafiti pareceu mais rápida porque `DafitiStagingRepository` já agrupava parte dos inserts com `jsonb_to_recordset`, mantinha caches de IDs e trabalhava em lotes. Essas otimizações ficaram presas no caminho específico, que ainda abria transações por lote e continha elegibilidade Dafiti. O motor compartilhado agora reutiliza a ideia válida de staging em massa, sem incorporar regras editoriais específicas. O caminho Dafiti antigo deve ser tratado como legado, não como um segundo motor para novos merchants.

## Fluxo e atomicidade

1. O gzip é descompactado e o CSV é interpretado por async iterators, que respeitam backpressure.
2. Itens válidos são normalizados um de cada vez e enviados em chunks (default 1.000; máximo 5.000) para uma tabela temporária via `jsonb_to_recordset`.
3. Merchant, feed e contagem esperados são fechados antes dos merges.
4. Índices temporários são criados; a classificação materializa o ID raw e agrega as contagens exclusivamente sobre `UPDATE ... RETURNING`. Linhas não retornadas são as novas. Os merges de Products, identidades, Variants, Offers e imagens são omitidos quando não há mudança.
5. A mesma transação cobre staging e merge; qualquer erro ou timeout executa rollback. `statement_timeout` é 5 minutos e `lock_timeout` 10 segundos por padrão.

`COPY` não foi escolhido porque o projeto não possui `pg-copy-streams`, e o protocolo COPY do driver exigiria uma dependência e um caminho de escape adicionais. `jsonb_to_recordset` já limita memória pelo chunk e mantém round-trips em O(lotes + tabelas), sem consulta por item.

## Chaves e índices existentes

Os `ON CONFLICT` e joins usam constraints já presentes, sem migração:

- provider: `uq_commerce_providers_code`;
- merchant: `uq_commerce_merchants_provider_external`;
- feed: `uq_commerce_feeds_provider_external`;
- identidade: `uq_external_products_provider_merchant_key`;
- Variant: `uq_product_variants_provider_merchant_key`;
- Offer: `uq_offers_provider_merchant_external_key`;
- raw item: `uq_commerce_raw_feed_identity`;

A classificação usa igualdade direta em provider, merchant, feed e `identity_hash`, na mesma chave do índice único persistente, e um índice temporário equivalente sobre a staging. Não há `OR` nem cast nessa junção. O refresh calcula no processo um timestamp de corte e compara `timestamp` com `timestamp`; janela zero usa um booleano parametrizado para refresh integral. Nenhum índice persistente novo é necessário para esse caminho.

As contagens `created`, `updated` e `unchanged` formam uma partição exclusiva da staging. O processo rejeita e reverte a transação se algum contador não for inteiro não negativo, se a soma divergir de `staged`, se `changed` divergir de `created + updated` ou se qualquer total exceder a staging. Isso impede que telemetria contraditória governe os merges.
- imagem: `uq_product_images_product_url` (parcial quando provider não é nulo).

A separação Product/Offer é preservada. IDs externos iguais não colidem entre merchants porque as chaves de identidade, Variant e Offer incluem provider e merchant. Variantes só são deduplicadas pela chave normalizada de Variant, não pela chave de Product.

## Presença raw sem churn

O `last_seen_at` do feed e o término da importação são registrados em toda execução. Para itens raw inalterados, `last_seen_at` e `updated_at` só são regravados após uma janela configurável, evitando reescrever milhares de linhas e seus índices em repetições próximas. O padrão é 24 horas; `--raw-last-seen-refresh-hours 0` restaura a atualização em toda importação. `first_seen_at` nunca é alterado. A detecção de `missingCandidates` não depende dessa janela: ela compara o conjunto completo da staging, por provider, merchant, feed e identidade.

## Observabilidade e capacidade

O CLI escreve em stderr fase, linhas, lotes, taxa, duração e round-trips. Após cada operação SQL, acrescenta somente nome lógico, duração, `rowCount` e round-trips acumulados daquela etapa; SQL e parâmetros não são expostos. O relatório final inclui a mesma telemetria sanitizada em `sql_steps`, além de contagens, política/quantidade de refresh raw, `missingCandidates`, tempo, rows/s e pico RSS.

O gzip é detectado pelo conteúdo da descompressão, não pelo sufixo usado para nomear o feed; portanto um gzip chamado `.csv` continua suportado quando passado a `openGzipFile`. Como o feed não é acumulado, o mesmo desenho atende 689 mil registros; o tempo e o tamanho da tabela temporária crescem com o feed, mas a memória Node permanece limitada ao chunk e ao parser.

## Benchmark sintético

Execute `npm run awin:import:benchmark` com `AWIN_TEST_DATABASE_URL` apontando exclusivamente para PostgreSQL local descartável terminado em `_import_test`. O dataset determinístico tem 20.000 linhas, dois merchants e cenários de carga inicial, repetição unchanged, atualização pontual e rollback para chunks 1.000/2.000. Cada medição expõe `sqlSteps`. É evidência local, não aprovação da meta de até 45 segundos no Supabase.
