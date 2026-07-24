# Domínio do BeUpFree

## 1. Objetivo do documento

Este documento apresenta o modelo conceitual inicial do domínio do BeUpFree. Seu objetivo é estabelecer um vocabulário comum para produto, negócio e engenharia, independentemente de banco de dados, API, framework ou outra decisão de implementação técnica.

## 2. Visão geral do domínio

O domínio pode ser representado, em visão simplificada, pelas seguintes relações:

```text
Marketplace parceiro
→ Oferta
→ Produto
→ Marca
→ Categoria

Usuário
→ Favoritos
→ Minha Lista
```

As setas indicam relações conceituais entre os elementos do domínio. Elas não representam obrigatoriamente dependências técnicas, estruturas de armazenamento ou uma sequência operacional.

## 3. Entidades e conceitos centrais

### Produto

- **Definição:** item apresentado ao consumidor no BeUpFree.
- **Responsabilidade no domínio:** reunir informações de identificação que permitam a descoberta e a consulta do item.
- **O que não representa:** não representa necessariamente uma oferta específica nem as condições comerciais de compra.
- **Relacionamentos:** pode possuir Oferta, Marca e Categoria.
- **Regras principais:** deve possuir informações de identificação; poderá estar associado a uma ou mais ofertas, conforme definição ainda em avaliação.
- **Status:** conceito confirmado; múltiplas ofertas por produto estão em avaliação.

### Oferta

- **Definição:** condição comercial de um Produto disponibilizada por um Marketplace parceiro.
- **Responsabilidade no domínio:** apresentar as condições comerciais disponíveis, que podem incluir preço atual, preço original, desconto, frete, disponibilidade e link.
- **O que não representa:** não representa o Produto em si nem uma transação realizada pelo BeUpFree.
- **Relacionamentos:** pertence a Marketplace parceiro, refere-se a Produto, pode ser classificada como Promoção e utiliza Link de afiliado.
- **Regras principais:** deve refletir os dados disponíveis no parceiro; suas condições podem mudar no ambiente externo.
- **Status:** conceito confirmado.

### Marketplace parceiro

- **Definição:** plataforma externa responsável por disponibilizar a Oferta, conduzir o checkout e realizar a transação.
- **Responsabilidade no domínio:** manter as condições comerciais e executar as etapas de compra em seu próprio ambiente.
- **O que não representa:** não representa o BeUpFree nem uma operação de venda realizada por ele.
- **Relacionamentos:** disponibiliza Oferta e recebe o Usuário encaminhado por Link de afiliado.
- **Regras principais:** é responsável pelo checkout, pagamento, estoque, disponibilidade e condições finais da transação.
- **Status:** Mercado Livre confirmado como parceiro atual; integração com outros marketplaces está em avaliação.

### Marca

- **Definição:** identificação comercial associada ao Produto.
- **Responsabilidade no domínio:** apoiar busca, filtros, organização e destaque de produtos.
- **O que não representa:** não representa Categoria, Oferta ou Marketplace parceiro.
- **Relacionamentos:** pode estar associada a Produto.
- **Regras principais:** não deve ser inferida quando não houver confiança suficiente em sua identificação.
- **Status:** conceito confirmado.

### Categoria

- **Definição:** classificação que organiza produtos por natureza ou finalidade.
- **Responsabilidade no domínio:** apoiar navegação, busca, filtros e organização do catálogo.
- **O que não representa:** não representa Marca nem condição comercial de uma Oferta.
- **Relacionamentos:** pode agrupar Produto.
- **Regras principais:** deve expressar uma organização compreensível do catálogo; não há cardinalidade rígida definida.
- **Status:** conceito confirmado; taxonomia definitiva em avaliação.

### Promoção

- **Definição:** classificação atribuída a uma Oferta que possui desconto efetivo válido.
- **Responsabilidade no domínio:** identificar ofertas que atendam às regras oficiais de desconto do BeUpFree.
- **O que não representa:** não representa um Produto distinto nem uma condição criada artificialmente pelo BeUpFree.
- **Relacionamentos:** classifica uma Oferta válida.
- **Regras principais:** depende das regras oficiais de desconto e somente pode existir quando sustentada pelos dados da Oferta.
- **Status:** conceito confirmado.

### Usuário

- **Definição:** pessoa que utiliza o BeUpFree.
- **Responsabilidade no domínio:** descobrir e consultar produtos e ofertas e, quando os recursos correspondentes estiverem disponíveis, salvar produtos como Favoritos ou adicioná-los à Minha Lista.
- **O que não representa:** não representa obrigatoriamente uma pessoa cadastrada ou autenticada.
- **Relacionamentos:** pode salvar Produto como Favorito e adicionar Produto à Minha Lista.
- **Regras principais:** cadastro e login não estão implementados; identificação persistente e sincronização não estão definidas.
- **Status:** conceito confirmado; cadastro, identidade persistente e sincronização em avaliação.

### Favorito

- **Definição:** Produto salvo pelo Usuário por interesse.
- **Responsabilidade no domínio:** permitir a identificação de produtos de interesse para consulta posterior.
- **O que não representa:** não representa intenção definitiva de compra nem Minha Lista.
- **Relacionamentos:** associa conceitualmente Usuário e Produto.
- **Regras principais:** deve preservar sua distinção conceitual em relação à Minha Lista.
- **Status:** conceito confirmado; persistência inicial em avaliação.

### Minha Lista

- **Definição:** seleção organizada de produtos para consulta e comparação.
- **Responsabilidade no domínio:** reunir produtos escolhidos pelo Usuário para organização e análise.
- **O que não representa:** não é carrinho, não executa checkout e não reserva estoque.
- **Relacionamentos:** reúne Produto selecionado por Usuário; eventual compartilhamento de infraestrutura com Favoritos depende de avaliação técnica.
- **Regras principais:** deve permanecer conceitualmente distinta de Favoritos e das funções transacionais do Marketplace parceiro.
- **Status:** conceito confirmado; persistência, quantidade de listas e compartilhamento de infraestrutura com Favoritos em avaliação.

### Link de afiliado

- **Definição:** endereço que direciona o Usuário ao Marketplace parceiro e identifica a origem afiliada do acesso.
- **Responsabilidade no domínio:** realizar o encaminhamento do BeUpFree para a Oferta no ambiente do parceiro.
- **O que não representa:** não representa venda, checkout ou transferência de responsabilidade pela transação ao BeUpFree.
- **Relacionamentos:** é utilizado pela Oferta para encaminhar o Usuário ao Marketplace parceiro.
- **Regras principais:** deve direcionar ao parceiro responsável pela Oferta e preservar a transparência sobre o destino da compra.
- **Status:** conceito confirmado.

## 4. Relacionamentos principais

- Produto pode possuir Oferta.
- Oferta pertence a Marketplace parceiro.
- Produto pode possuir Marca.
- Produto pode pertencer a Categoria.
- Promoção é uma classificação de Oferta válida.
- Usuário pode salvar Produto como Favorito.
- Usuário pode adicionar Produto à Minha Lista.
- Oferta utiliza Link de afiliado para encaminhamento ao parceiro.

Esses relacionamentos são conceituais. Cardinalidades rígidas não são definidas enquanto não houver decisões aprovadas que as sustentem.

## 5. Limites do domínio

O BeUpFree organiza a descoberta de produtos e ofertas, apresenta as informações disponíveis e encaminha o Usuário ao Marketplace parceiro.

O BeUpFree:

- não realiza checkout;
- não processa pagamento;
- não controla o estoque do parceiro;
- não garante a permanência do preço ou da disponibilidade após o redirecionamento.

As condições finais da Oferta e a transação são de responsabilidade do Marketplace parceiro.

## 6. Decisões em avaliação

Os seguintes temas permanecem com status **Em avaliação**:

- persistência de Favoritos;
- persistência de Minha Lista;
- existência de uma ou várias listas;
- cadastro e identidade de Usuário;
- múltiplas ofertas por Produto;
- taxonomia definitiva de categorias;
- integração com novos marketplaces;
- tratamento de produtos e ofertas encerradas.

## 7. Glossário resumido

- **Produto:** item apresentado ao consumidor para descoberta e consulta.
- **Oferta:** condição comercial de um Produto em um Marketplace parceiro.
- **Marketplace parceiro:** plataforma externa responsável pela Oferta, pelo checkout e pela transação.
- **Marca:** identificação comercial do Produto.
- **Categoria:** organização de produtos por natureza ou finalidade.
- **Promoção:** Oferta com desconto efetivo válido conforme as regras oficiais.
- **Usuário:** pessoa que utiliza o BeUpFree.
- **Favorito:** Produto salvo por interesse para consulta posterior.
- **Minha Lista:** seleção organizada de produtos para consulta e comparação.
- **Link de afiliado:** endereço de encaminhamento ao parceiro que identifica a origem afiliada.
