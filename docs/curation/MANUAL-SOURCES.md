# Fontes manuais de curadoria

## Objetivo e conceito

`curation_sources` registra páginas de listas, promoções e campanhas encontradas manualmente pela equipe de curadoria. O cadastro é somente uma fonte editorial: nesta etapa ele não dispara coleta, não cria produtos e não participa do scheduler.

A entidade é separada de `collection_sources`, que hoje representa configuração técnica de coletores automáticos e possui frequência, execuções e memberships.

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

`active` significa que a fonte pode ser considerada por processos futuros. O sistema não muda automaticamente uma fonte vencida para `ended`; a interface apenas sinaliza prazo vencido. Fontes terminadas são preservadas e encerradas por status, sem exclusão física na API.

## Fluxo administrativo

A página `/admin/curadoria/listas` permite listar e filtrar por status, marketplace e tipo; cadastrar e editar uma fonte; ativar, desativar ou marcar como encerrada. Ela é acessível pela tela de Triagem.

O fluxo operacional de cadastro, edição, desativação e filtro possui cobertura E2E própria e integra a regressão V1. Os testes criam marketplace e fonte temporários e removem somente esses registros, sem truncar o catálogo.

As rotas estão em `/api/admin/curation-sources`. A aplicação administrativa existente ainda não possui middleware de autenticação/autorização de administrador. CURA001 mantém esse padrão, sem reutilizar indevidamente a autenticação de clientes. Isso é um risco conhecido e deve ser resolvido por uma decisão arquitetural de acesso administrativo.

## Multi-marketplace

Nenhum tipo ou campo é específico do Mercado Livre. Toda fonte aponta para a tabela genérica `marketplaces`, portanto Amazon, Shopee, Shein e parceiros futuros funcionam sem alteração do modelo.

## Evolução futura

- CURA002 — Coletar agora.
- CURA003 — Agendamento.
- CURA004 — Monitoramento automático de campanhas.

Essas evoluções devem consumir fontes ativas explicitamente, mantendo histórico e separando cadastro editorial de execução técnica.
