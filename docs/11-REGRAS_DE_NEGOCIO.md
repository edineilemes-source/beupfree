# Regras de Negócio

## 1. Objetivo do documento

Este documento registra a primeira versão institucional das regras de negócio do BeUpFree. Seu propósito é orientar decisões de produto e implementação, preservar a coerência da experiência UpPulse e distinguir regras aprovadas de assuntos que ainda estão em avaliação.

## 2. Conceitos fundamentais

### Produto

Item apresentado no catálogo do BeUpFree para descoberta e consulta pelo consumidor. O produto reúne informações de identificação e pode estar associado a uma oferta disponível em um marketplace parceiro.

### Oferta

Condição comercial vinculada a um produto, composta pelas informações disponíveis, como preço atual, preço original, percentual de desconto, frete e endereço de destino. A venda não é realizada pelo BeUpFree.

### Marketplace parceiro

Plataforma externa responsável por disponibilizar a oferta, conduzir a compra e executar o checkout. Na integração atual do catálogo, o parceiro identificado é o Mercado Livre.

### Promoção

Oferta que apresenta desconto efetivo válido conforme as regras deste documento. Uma promoção não deve ser criada ou comunicada sem sustentação nos dados da oferta.

### Link de afiliado

Endereço utilizado para direcionar o consumidor à oferta no marketplace parceiro e identificar a origem afiliada do acesso. O link não transfere ao BeUpFree a responsabilidade pela venda ou pelo checkout.

## 3. Regras de desconto

- Um percentual de desconto informado tem prioridade quando for numérico, finito e maior que zero.
- O percentual informado válido deve ser arredondado e limitado a 100%.
- Na ausência de percentual informado válido, o desconto deve ser calculado a partir do preço atual e do preço original.
- O cálculo pelos preços só produz desconto quando ambos são válidos e positivos e o preço original é maior que o preço atual.
- O desconto calculado deve ser arredondado e limitado a 100%. Quando os dados não permitirem um desconto válido e positivo, o resultado deve ser zero.
- Uma única regra de desconto efetivo deve ser utilizada na exibição, nos filtros e na ordenação do catálogo.

## 4. Busca

- O parâmetro oficial da busca na URL é `busca`.
- O parâmetro antigo `q` deve continuar sendo aceito para leitura por compatibilidade.
- Quando ambos estiverem presentes, `busca`, se preenchido, tem prioridade.
- Novas buscas devem gravar `busca` e remover `q`.
- Os demais parâmetros existentes na URL, incluindo filtros ativos, devem ser preservados ao realizar uma nova busca.
- A busca textual não diferencia letras maiúsculas e minúsculas nem acentos.
- A busca deve atuar em conjunto com os filtros do catálogo.

## 5. Favoritos

### Conceito

Favoritos representam produtos salvos pelo usuário.

### Objetivo

Permitir que produtos de interesse sejam identificados e consultados novamente.

### Status atual

Funcionalidade planejada para a próxima sprint. A presença de um elemento visual no cabeçalho não representa um fluxo funcional concluído.

### Decisões pendentes — Em avaliação

- persistência inicial em `localStorage`, banco ou abordagem híbrida;
- tratamento de produtos removidos e ofertas encerradas;
- eventual identificação de uso sem conta;
- futura sincronização com conta, condicionada à evolução de cadastro e login.

## 6. Minha Lista

### Conceito

Minha Lista representa uma seleção organizada de produtos para consulta e comparação.

### Diferença para Favoritos

Favoritos registram produtos salvos por interesse. Minha Lista organiza uma seleção com intenção de consulta e comparação. Os conceitos devem permanecer distintos, ainda que uma infraestrutura técnica possa ser compartilhada após avaliação.

### Diferença para Carrinho

Minha Lista não é um carrinho. Ela não realiza checkout, reserva de estoque, cálculo conjunto de frete ou compra unificada. A conclusão da compra ocorre no marketplace parceiro.

### Decisões pendentes — Em avaliação

- persistência inicial em `localStorage`, banco ou abordagem híbrida;
- existência de uma única lista ou de múltiplas listas nomeadas;
- campos apresentados para apoiar a comparação;
- limite de itens;
- compartilhamento de infraestrutura com Favoritos.

## 7. Compra

### Responsabilidade do marketplace parceiro

O marketplace parceiro é responsável pelas condições finais da oferta, disponibilidade, estoque, frete, pagamento, checkout e demais etapas da transação realizadas em seu ambiente.

### Papel do BeUpFree

O BeUpFree é uma plataforma de descoberta e afiliação. Seu papel é organizar e apresentar informações de produtos e ofertas e direcionar o consumidor ao parceiro por meio do link correspondente. O BeUpFree não deve prometer checkout ou carrinho unificado sem integração comprovada.

## 8. Produtos em destaque

### Critérios atuais conhecidos

Na área promocional principal do catálogo atual:

- somente produtos com imagem, oferta e desconto efetivo maior que zero podem ser selecionados;
- os produtos elegíveis são priorizados pelo maior desconto efetivo;
- busca-se apresentar uma oferta de cada marca prioritária atual: Nike, Adidas e Olympikus;
- quando uma marca prioritária não possui produto elegível, os espaços restantes são preenchidos pelas melhores ofertas disponíveis;
- no primeiro preenchimento, produtos com marca não identificada são evitados; se necessário, podem ser usados para completar os espaços restantes;
- a área exibe até três produtos.

### Pontos em avaliação

- critérios editoriais adicionais além das regras atuais;
- alteração das marcas prioritárias;
- inclusão de desempenho, disponibilidade ou outros dados na seleção;
- frequência e governança de revisão dos critérios de destaque.

## 9. Regras permanentes

- **Transparência:** comunicar com clareza o papel do BeUpFree e o destino da compra.
- **Integridade das informações:** apresentar produtos, preços, descontos e condições com base nos dados disponíveis, sem manipulação.
- **Promoções legítimas:** não criar promoções artificiais nem comunicar economia sem suporte nos dados da oferta.
- **Informação acessível:** não ocultar preços, condições relevantes ou o acesso ao marketplace parceiro.
- **Publicidade identificável:** não apresentar publicidade disfarçada de recomendação.

## 10. Glossário

- **BeUpFree:** nome do produto e da plataforma de descoberta e afiliação.
- **UpPulse:** nome atual da experiência/site do BeUpFree.
- **Catálogo:** conjunto de produtos e ofertas disponibilizados para descoberta, busca e filtragem.
- **Checkout:** etapa de conclusão da compra, realizada no marketplace parceiro.
- **Desconto efetivo:** percentual obtido pela regra única que prioriza o valor informado válido e, quando necessário, calcula o desconto pelos preços.
- **Favoritos:** produtos salvos pelo usuário para consulta posterior; funcionalidade ainda planejada.
- **Minha Lista:** seleção organizada de produtos para consulta e comparação; funcionalidade ainda planejada e distinta de um carrinho.
- **Marketplace parceiro:** plataforma externa responsável pela oferta e pela transação.
- **Oferta:** condição comercial associada a um produto.
- **Produto:** item apresentado no catálogo.
- **Promoção:** oferta com desconto efetivo válido.
