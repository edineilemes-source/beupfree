# Homologação isolada da Missão 7

Base: cópia da Missão 5. Motor original preservado, parser V1.5 e matcher V1.2. Sem Git, commit, push, merge ou deploy.

A aplicação lê o banco descartável `uppulse_missao7` do container `uppulse-missao7-pg17`, publicado apenas em `127.0.0.1:5436`. O preview desta missão usa `127.0.0.1:5018`. O `.env` local tem permissão 0600 e não integra o patch de entrega. Nunca substituir suas conexões por bancos existentes.

A migration `0013_master_identity_sidecar.sql` já foi aplicada exclusivamente ao banco descartável. Não há migration automática no startup, nem uso de db:push. A migração segue as quatro estruturas laterais de OPERATIONAL-INTEGRATION-V1, acrescentando uma fila independente. Variantes continuam nas entidades de origem; não existe consolidação global de SKU.

Comandos de validação nesta cópia:

```bash
npm run check
npm run test:product-identity
npm run test:unit
npm run test:master-integration
npm run test:master-ui
UPPULSE_CATALOG_PREVIEW_ENABLED=true npm run build
```

O preview usa assets compilados e NODE_ENV=development para homologação HTTP local, mantendo a configuração de sessão já existente para esse ambiente. Não é publicação em produção. Para iniciá-lo caso a porta esteja livre:

```bash
python3 scripts/missao7-preview.py --built
```

`MASTER_IDENTITY_ENABLED` habilita a leitura e as notificações pós-reconciliação dos dois importadores. A fila não executa feeds: seu worker só lê entidades já reconciliadas. O scheduler externo está desligado por `UPPULSE_DISABLE_EXTERNAL_JOBS=true` nesta homologação. Nenhuma importação real foi executada.

Para processar uma notificação específica, com orçamento de um lote por chamada:

```bash
npm run identity:worker:homologation -- ID_DO_JOB 1
```

O worker registra cursor e plano fixo, permite retry e mantém todos os membros vigentes de cada Master no mesmo lote. Coortes têm até 2.000 identidades. Pares entre lotes permanecem NOT_EVALUATED. Concluir todos os lotes não comprova cobertura de todos os pares. Top-K e budgets históricos permanecem intactos.

O writer lê novamente as origens em uma transação consistente, serializa writers antes de abrir o snapshot, rejeita a ausência de membros de um Master já existente e verifica todos os pares dos novos grupos. Não altera products, offers, product_variants nem a projeção V4. Reprocessamento fecha vínculos anteriores e preserva decisões e evidências imutáveis. Reutiliza o ID Master somente quando seu grupo inteiro e atributos históricos são compatíveis. Reexecução de um run histórico já superado exige uma nova revisão explícita, em vez de reativar silenciosamente decisões antigas.

A API pública opcional é `GET /api/master-identities/:productId`. Suas consultas usam uma transação READ ONLY consistente. Produtos ambíguos, fora da publicação vigente ou com evidência desatualizada não recebem enriquecimento. A leitura do catálogo permanece independente: nenhum join 1:N foi adicionado à paginação, aos filtros ou às facetas.

O nome comercial Master continua nulo: não foi localizada regra histórica para gerá-lo. `modelFamily` é apresentado apenas como família técnica. A hierarquia exibida é Master → produtos de origem → variantes de origem; as ofertas preservam fornecedor, preço, desconto e link afiliado próprios. REVIEW não forma equivalência. AUTO_MATCH de atributos observados não comprova SKU igual.

Não existe ainda operação de revisão humana, roll-out em produção ou worker contínuo com supervisão. Falha ao enfileirar é isolada da importação e registrada por aviso sanitizado; requer reprocessamento explícito. Ver resultados, cobertura e ocorrências operacionais no relatório externo `../../RELATORIO-MISSAO-7.md`.
