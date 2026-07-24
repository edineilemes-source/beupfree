# Backlog do Produto

Este documento separa entregas concluídas, o escopo proposto para a próxima sprint e possibilidades futuras. O backlog futuro é indicativo e não representa compromisso fechado de implementação, prazo ou prioridade.

## Concluído

### Sprint 01 — Busca e descontos

- busca pelo cabeçalho;
- acionamento da busca por Enter e pela lupa;
- adoção do parâmetro oficial `busca`;
- compatibilidade de leitura com o parâmetro antigo `q`;
- busca sem diferença entre maiúsculas, minúsculas e acentos;
- integração da busca com os filtros do catálogo;
- correção dos cards promocionais;
- cálculo padronizado do percentual de desconto.

## Próxima sprint

### Sprint 02 — Favoritos e Minha Lista

#### Favoritos

- **Objetivo:** permitir que o usuário salve produtos de interesse para consultá-los novamente.
- **Escopo inicial:** oferecer ação para favoritar e desfavoritar produtos, identificar visualmente o estado salvo e disponibilizar uma visualização dos produtos favoritos.
- **Critérios de aceite:** o usuário consegue adicionar e remover um produto; o estado visual corresponde ao estado persistido; a lista de favoritos exibe apenas os itens salvos; o comportamento permanece consistente após recarregar a página, conforme a estratégia de persistência escolhida.
- **Fora do escopo:** cadastro e login; sincronização entre dispositivos; alertas de preço; compartilhamento de favoritos; recomendações baseadas nos itens salvos.
- **Dúvidas antes da implementação:** qual será a persistência inicial — `localStorage`, banco ou abordagem híbrida?; como tratar produtos removidos ou ofertas encerradas?; favoritos exigirão alguma identificação anônima além do navegador?

#### Minha Lista

- **Objetivo:** permitir que o usuário organize uma seleção de produtos para consulta e comparação, sem representar um carrinho ou checkout próprio.
- **Escopo inicial:** adicionar e remover produtos de uma lista, visualizar os itens selecionados e apresentar as informações de produto e oferta disponíveis no catálogo.
- **Critérios de aceite:** o usuário consegue incluir e excluir produtos; a visualização mostra somente os itens selecionados; itens duplicados não são criados; os links de compra continuam direcionando ao marketplace parceiro; o estado permanece após recarregar a página, conforme a persistência definida.
- **Fora do escopo:** carrinho unificado; checkout no BeUpFree; reserva de estoque; soma de frete; compra conjunta em um ou mais marketplaces; comparação histórica de preços.
- **Dúvidas antes da implementação:** qual será a persistência inicial — `localStorage`, banco ou abordagem híbrida?; haverá uma única lista ou múltiplas listas nomeadas?; quais campos serão apresentados para apoiar a comparação?; qual será o limite de itens?; Favoritos e Minha Lista compartilharão infraestrutura de armazenamento?

## Backlog futuro

Os itens abaixo são possibilidades de evolução. Dependem de priorização, validação de produto e decisões técnicas futuras.

- cadastro e login;
- sincronização dos favoritos com conta;
- alertas de preço;
- histórico de preços;
- comparação de ofertas;
- recomendações;
- SEO;
- produção na Hostinger;
- expansão para outros afiliados.

