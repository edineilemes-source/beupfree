# Fontes configuráveis

Tênis/Mercado Livre é o primeiro caso de uso, não o domínio arquitetural do UpPulse.

## Princípios

1. Fontes são dados persistidos e administráveis.
2. Coletores são código reutilizável por várias fontes.
3. Nenhuma categoria comercial deve ser hardcoded como domínio central.
4. Nenhuma URL operacional deve depender permanentemente de deploy.
5. Providers são extensíveis e resolvidos centralmente.
6. Produtos/bens devem evoluir para um modelo genérico.
7. Ofertas devem evoluir para múltiplas modalidades comerciais.
8. Autorização futura não deve alterar a entidade fonte.

## Arquitetura e transição

`executeSource` valida a configuração persistida, resolve o coletor pelo slug do provider, executa e grava `curation_source_runs`. Configuração e capacidade técnica são independentes: uma fonte pode apontar para provider ainda sem coletor. Um coletor atende várias fontes.

O coletor Mercado Livre usa temporariamente um adapter para `collection_sources`, preservando scraping, enriquecimento, raw items, normalização, memberships, triagem, produtos e ofertas. Não há pipeline paralelo. O scheduler ainda lê `collection_sources`: migrá-lo nesta missão exigiria alterar FKs, desativação por lote e consultas públicas. Sua convergência para `curation_sources -> executeSource()` fica em CURA003/CURA005; o adapter não representa uma “fonte do sistema”.

Hardcodes operacionais remanescentes: “Ofertas Calçados (Geral)”/MLB3900 em `collectCollections.ts`; a identificação dessa seção por URL em `dealSections.ts`; e “Ofertas Calçados Esportivos”/MLB23332 no endpoint legado de `mlScraper.ts`. Endpoints técnicos de API/OAuth não são campanhas operacionais.

## Evolução do domínio

Produto hoje contém gênero, tipo de uso e cor, e a normalização conhece categorias de calçados. A direção é Produto/Bem com atributos extensíveis por categoria, evitando colunas centrais específicas de tênis, notebook, automóvel ou imóvel.

Oferta hoje presume venda (preço, desconto, frete e parcelas). Deve evoluir para Produto/Bem -> múltiplas ofertas -> provider/canal -> modalidade (`sale`, `rent`, `lease`, `service`, `other`). `transaction_type` não foi adicionado para evitar mudança ampla do catálogo.

`marketplaces` permanece por compatibilidade, sem impor que todo provider futuro seja e-commerce. ARCH002 poderá generalizá-lo para provider/channel. RBAC pertence à autorização, não à entidade fonte: papéis futuros poderão controlar visualizar, criar, editar, ativar, desativar, executar, agendar e excluir. As rotas administrativas ainda não possuem autorização formal; autenticação de cliente não equivale a autorização administrativa.

## Roadmap

- **CURA003:** agendamento configurável e scheduler genérico.
- **CURA004:** monitoramento e saúde das fontes.
- **CURA005:** eliminar fontes/URLs operacionais hardcoded remanescentes.
- **ARCH001:** generalização Produto/Bem e atributos extensíveis.
- **ARCH002:** generalização Provider/Channel.
- **ARCH003:** modalidades venda, aluguel, locação, serviço e outras.
- **SEC001:** usuários administrativos, papéis e permissões.
