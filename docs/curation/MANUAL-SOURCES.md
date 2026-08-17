# Fontes operacionais configuráveis

## Objetivo e conceito

`curation_sources` registra as fontes configuradas para alimentar o UpPulse. Fontes ativas cujo provider possui coletor podem ser executadas manualmente por **Coletar agora**.

O endpoint `POST /api/admin/curation-sources/:id/collect` aceita somente o ID persistido, valida a fonte, resolve o coletor pelo provider, reutiliza a ingestão existente e registra o resultado em `curation_source_runs`. Provider sem coletor continua cadastrável e recebe uma mensagem operacional específica.

Durante a transição, o coletor Mercado Livre adapta internamente a fonte para `collection_sources`, pois lotes, memberships e triagem ainda possuem FKs para essa tabela. Isso não constitui uma segunda classe permanente de fonte nem aparece como “Fonte do Sistema” na interface.

## Campos

- `name`: nome obrigatório da lista.
- `marketplace_id`: referência obrigatória a um registro de `marketplaces`.
- `url`: URL HTTP(S) obrigatória.
- `source_type`: `promotion`, `brand`, `category`, `outlet`, `campaign` ou `other`.
- `status`: `active`, `inactive` ou `ended`.
- `priority`: inteiro não negativo; valores maiores aparecem primeiro.
- `starts_at` e `ends_at`: datas opcionais. Quando ambas existem, o fim não pode anteceder o início.
- `notes`: observações opcionais.
- `created_at` e `updated_at`: auditoria temporal básica.

`active` significa que a fonte pode ser coletada, desde que esteja dentro do período configurado e exista coletor para seu provider. Fontes `inactive` e `ended` não podem ser executadas.

## Fluxo administrativo

A página `/admin/curadoria/listas` permite administrar e executar fontes e consultar a última execução.

O fluxo operacional de cadastro, edição, desativação e filtro possui cobertura E2E própria e integra a regressão V1. Os testes criam marketplace e fonte temporários e removem somente esses registros, sem truncar o catálogo.

As rotas estão em `/api/admin/curation-sources`. A aplicação administrativa existente ainda não possui middleware de autenticação/autorização de administrador. CURA001 mantém esse padrão, sem reutilizar indevidamente a autenticação de clientes. Isso é um risco conhecido e deve ser resolvido por uma decisão arquitetural de acesso administrativo.

## Multi-marketplace

Nenhum tipo ou campo é específico do Mercado Livre. Toda fonte aponta para a tabela genérica `marketplaces`, portanto Amazon, Shopee, Shein e parceiros futuros funcionam sem alteração do modelo.

## Evolução futura

- CURA003 — Agendamento.
- CURA004 — Monitoramento automático de campanhas.

Essas evoluções devem consumir fontes ativas explicitamente, mantendo histórico e separando cadastro editorial de execução técnica.
