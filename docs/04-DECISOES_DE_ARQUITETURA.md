# Decisões de Arquitetura

Os registros abaixo distinguem decisões aceitas de pontos que ainda dependem de definição.

## Busca do catálogo

- **Contexto:** a busca do catálogo precisa manter uma URL canônica sem quebrar links que usam o parâmetro anterior, além de coexistir com filtros ativos.
- **Decisão:** usar `busca` como parâmetro oficial; manter compatibilidade de leitura com `q`; remover `q` ao realizar novas buscas; preservar os demais parâmetros da URL.
- **Motivo:** padronizar novas URLs, manter compatibilidade com URLs antigas e evitar a perda de filtros durante uma busca.
- **Consequência:** componentes que leem a busca devem priorizar `busca` e recorrer a `q` apenas como compatibilidade; novas escritas devem usar somente `busca` e conservar os outros parâmetros.
- **Status:** Aceita.

## Percentual de desconto

- **Contexto:** desconto é usado nos cards, filtros e ordenação e precisa produzir o mesmo resultado em todos esses pontos.
- **Decisão:** manter uma única função para calcular o desconto efetivo. Um percentual informado, quando válido, tem prioridade; caso contrário, o percentual é calculado a partir dos preços atual e original. A mesma regra deve alimentar exibição, filtros e ordenação.
- **Motivo:** evitar resultados divergentes e duplicação de lógica.
- **Consequência:** qualquer novo uso do desconto deve reutilizar a função central; mudanças na regra devem ser realizadas e validadas em um único lugar.
- **Status:** Aceita.

## Modelo de compra

- **Contexto:** o BeUpFree organiza a descoberta de produtos e ofertas, enquanto a transação é realizada pelo parceiro.
- **Decisão:** tratar o BeUpFree como plataforma de descoberta e afiliação; direcionar o checkout ao marketplace parceiro; não prometer carrinho unificado sem integração comprovada; adotar “Minha Lista” como conceito inicial no lugar de um carrinho tradicional.
- **Motivo:** alinhar a experiência ao modelo de afiliação e evitar transmitir que o BeUpFree opera uma compra que pertence ao parceiro.
- **Consequência:** chamadas para compra devem deixar claro o destino externo; Minha Lista servirá à organização e consulta, sem checkout, reserva de estoque ou compra conjunta no BeUpFree.
- **Status:** Aceita.

## Separação entre Favoritos e Minha Lista

- **Contexto:** embora ambos guardem referências a produtos, os conceitos atendem a intenções diferentes do usuário.
- **Decisão:** manter os conceitos separados. Favoritos representam produtos salvos; Minha Lista representa uma seleção organizada para consulta e comparação.
- **Motivo:** preservar clareza de propósito e permitir a evolução independente das duas experiências.
- **Consequência:** interface, estados e regras devem distinguir a ação de favoritar da ação de adicionar à Minha Lista, ainda que uma infraestrutura interna possa ser compartilhada após avaliação técnica.
- **Status:** Aceita.

## Persistência de Favoritos e Minha Lista

- **Contexto:** a Sprint 02 requer que os itens salvos permaneçam disponíveis, mas cadastro, login e sincronização com conta estão no backlog futuro.
- **Decisão:** escolher antes da implementação entre `localStorage`, banco ou abordagem híbrida.
- **Motivo:** cada alternativa afeta experiência sem login, sincronização futura, privacidade, complexidade e migração de dados.
- **Consequência:** o desenho técnico e parte dos critérios de aceite da Sprint 02 dependem dessa escolha.
- **Status:** Pendente.

