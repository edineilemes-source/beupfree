# Comparação Inteligente

## Status

A Comparação Inteligente foi adiada na V1 do UpPulse. A interface pública não exibe seleção de produtos, bandeja de comparação, navegação ou a rota `/comparar`, mas a implementação foi preservada para uma futura reativação.

## Por que foi adiada

A V1 deve concentrar a experiência nas jornadas principais de descoberta de ofertas, catálogo e favoritos. Publicar a comparação agora adicionaria uma decisão paralela à compra antes de haver cobertura e consistência de dados suficientes para sustentar recomendações confiáveis entre diferentes ofertas e marketplaces.

O adiamento também permite validar primeiro o comportamento de uso do catálogo e dos favoritos. Esses sinais ajudarão a definir quais critérios realmente importam na comparação, sem descartar o trabalho técnico já realizado.

## O que já existe

A base da funcionalidade permanece no código e inclui:

- `Decision Engine`, com modelos, critérios, analisadores e testes unitários;
- módulo `comparison-intelligence`, com pontuação, seleção de líderes, insights e testes unitários;
- modelo e adaptador de produtos comparáveis;
- persistência local versionada e contexto React para a seleção;
- botão de seleção, bandeja e página completa de comparação;
- tratamento de limite, remoção, limpeza e sincronização da seleção entre abas;
- apresentação de critérios como preço, desconto, avaliação, quantidade de avaliações e frete.

Esses artefatos não fazem parte da interface pública da V1, mas continuam disponíveis como base de evolução.

## Quando deverá retornar

A funcionalidade deverá voltar em uma versão posterior, após a estabilização da V1 e quando os seguintes critérios estiverem atendidos:

1. catálogo com cobertura suficiente de atributos comparáveis;
2. qualidade e atualização dos dados monitoradas por marketplace;
3. regras de equivalência entre produtos e ofertas definidas;
4. critérios e pesos validados com dados reais de uso;
5. experiência responsiva e acessível validada com usuários;
6. métricas de impacto e testes E2E da jornada reativados.

A reativação deve ocorrer por novo planejamento de produto, não apenas pela restauração visual dos componentes.

## Dados técnicos necessários

Para produzir comparações úteis e auditáveis, serão necessários:

- identificadores estáveis de produto, oferta, seller e marketplace;
- título, marca, categoria, modelo e variante normalizados;
- preço atual, preço anterior, desconto e histórico de preço com data de coleta;
- disponibilidade, estado da oferta e última atualização;
- valor e prazo de frete, além da indicação de frete grátis;
- avaliação média, quantidade de avaliações e origem desses dados;
- atributos específicos por categoria, como uso indicado, material, tecnologia, tamanho, cor e público;
- regras de normalização e deduplicação para reconhecer ofertas do mesmo produto;
- indicadores de completude, confiabilidade e atualidade por campo;
- eventos de seleção, remoção, abertura da comparação e clique na oferta, respeitando consentimento e privacidade;
- versionamento dos critérios, pesos e justificativas emitidas pelo Decision Engine.

Antes da reativação, a integração deve prever estados de dados ausentes, empates, produtos esgotados e diferenças de moeda ou condições comerciais. As recomendações precisam expor os critérios usados e evitar conclusões quando a qualidade dos dados não for suficiente.
