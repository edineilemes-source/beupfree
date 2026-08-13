# Favoritos persistentes

Favoritos anônimos ficam em `beupfree:favorites:v1`. Favoritos autenticados têm o PostgreSQL como fonte oficial e usam apenas cache local por conta em `beupfree:favorites:user:<userId>:v1`.

## Regra operacional do catálogo

Depois da entrada de usuários reais em produção, o catálogo não deve ser reconstruído com `TRUNCATE` seguido de recriação dos produtos. Essa operação pode invalidar os `productId` referenciados pelos favoritos. A identidade canônica após reingestão será tratada em uma evolução futura.
