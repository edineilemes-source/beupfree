# UPCAT002 — transição controlada do catálogo público

`GET /api/products` mantém o catálogo demo por padrão. A seleção operacional é genérica e lê `catalog_search_products`, cuja unidade é Product + merchant e cuja oferta representativa permanece identificada separadamente. Nenhum merchant é fixado no caminho público.

## Gate reversível

A fonte operacional somente é selecionada quando `UPPULSE_PUBLIC_CATALOG_SOURCE=operational`, `UPPULSE_PUBLIC_CATALOG_APPROVED=true` e `AWIN_CURATOR_DATABASE_URL` existem simultaneamente. Configuração ausente ou parcial mantém `demo`. Esta missão não define essas variáveis em produção e não apaga os demos. Ativação real exige autorização humana nova, configuração controlada, smoke tests de lista/detalhe/clique e rollback para `demo`.

## Elegibilidade e ciclo de vida

Uma oferta pública precisa estar em `CATALOG_ELIGIBLE`, disponível, em BRL, ter preço anterior maior que o atual, link afiliado, Product com nome/marca/imagem e snapshot com no máximo três dias. A política modela `DRAFT → PUBLISHED`, pausa/resume, refresh e expiração. Oferta expirada volta a `DRAFT` após refresh; não é republicada diretamente. A projeção elegível não equivale a publicação.

O adaptador público aplica disponibilidade na consulta. Antes da ativação real, o gate humano deve validar em homologação a atualização/expiração e as superfícies de detalhe e clique; até lá, o default demo é obrigatório.

## Ranking e filtros

`recommended` combina disponibilidade, completude (imagem, tamanhos e cores), atividades, força da oferta com desconto limitado e recência. Product ID e merchant ID são desempates estáveis. Ordenações explícitas por desconto, preço, nome ou marca continuam disponíveis e não alteram filtros; filtros são aplicados antes do ranking.
