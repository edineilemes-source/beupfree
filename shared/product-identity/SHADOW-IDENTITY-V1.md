# Product Identity V1.3 — Shadow Identity multi-marketplace

Data: 2026-09-29. Branch: `codespace-preview`. Base: `a6b59ac`, merge oficial
PR #8 contendo Product Identity V1.2 (`95ceb31`).

Implementação local, sem persistência operacional. **Identity é enriquecimento;
promoção e regras comerciais continuam determinando publicação.**

Referência arquitetural: [OPERATIONAL-INTEGRATION-V1.md](OPERATIONAL-INTEGRATION-V1.md).
Esse arquivo já estava não rastreado no pré-voo e foi preservado. Não havia outra
alteração preexistente. A instrução específica desta missão mantém a branch atual
e proíbe commit, push, merge e deploy.

## Arquitetura e execução

```text
Entidades reconciliadas (input local)
→ Adapter de Merchant Product
→ Snapshot / SHA-256
→ Candidate Generator (usa parse V1.2 para marca/tipo)
→ Parser V1.2 (resultado reutilizado)
→ Matcher V1.2
→ Master / Variant decisions
→ Verificação de todos os pares do grupo
→ Grupos temporários e relatório shadow
```

O parser é executado uma vez por snapshot antes da recuperação, para reutilizar
marca/tipo reconhecidos sem duplicar vocabulário. Os candidatos usam tokens do
parse somente para recuperação. A decisão vem exclusivamente do matcher V1.2.

Não há import do Shadow no servidor HTTP, no builder, nos repositories comerciais,
nos coletores ou na UI. O comando local roda em processo separado. Não existe flag
comercial, job automático, consulta SQL, cliente de banco ou writer neste módulo.
A entrada pública com contenção de falhas é `runReconciledShadow`; as funções
internas lançam erros de validação. Uma execução inválida retorna `FAILED`, sem
identidades substitutas e sem imprimir mensagens de exceção potencialmente sensíveis.

### Arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `server/productIdentity/contracts.ts` | DTO, allowlist, canonicalização, snapshot, hashes e versões |
| `server/productIdentity/adapter.ts` | Leitura e validação de registros reconciliados em memória |
| `server/productIdentity/candidates.ts` | Recuperação textual, blocos e limites |
| `server/productIdentity/grouping.ts` | Agrupamento conservador por verificação de pares |
| `server/productIdentity/shadow.ts` | Orquestração, decisões e relatório |
| `server/productIdentity/fixtures.ts` | Coorte sintética de três merchants e dois providers |
| `server/productIdentity/shadow.test.ts` | Cenários adversariais e preservação V1.2 |
| `server/productIdentity/commercialIsolation.test.ts` | Equivalência comercial OFF/SHADOW |
| `scripts/product-identity-shadow.ts` | CLI local, JSON em stdout |
| `shared/product-identity/validation/shadow-v1-fixture-report.json` | Relatório auditável da fixture |
| `shared/product-identity/SHADOW-IDENTITY-V1.md` | Este documento |

Único arquivo existente modificado: `package.json`, para incluir os novos testes
em `test:unit` / `test:product-identity` e adicionar `identity:shadow`.

## DTO e adapter

`MerchantProduct` representa a identidade externa e seu produto de origem:

- `productId`, `externalIdentityId`, `providerId`, `merchantId`, `feedId` opcional;
- `externalProductKey` escopada por provider + merchant;
- `input`: nome observado, marca quando disponível, GTIN/MPN e tamanho com sistema
  explícito quando fornecidos em um contrato de evidência apropriado;
- `scope`: `PRODUCT_TITLE` ou `SELECTED_VARIANT`, com ID da variante selecionada;
- `observedVariants`: IDs, chave externa, tamanho, cor, GTIN/EAN/UPC/MPN e datas
  disponíveis. Observação não equivale a evidência usada pelo matcher;
- `provenance`: entidade, registro, campo e método disponível;
- timestamps de produto/identidade e diagnósticos de associação.

`adaptReconciledRows` recebe array de `product`, `identity`, `provider`, `merchant`,
`feed`, `brand` e `variants`. Campos camelCase correspondem aos campos Drizzle.
O schema Zod exportado define o contrato exato. Datas aceitam `Date` das entidades
ou ISO com timezone, normalizadas para UTC. Campos extras são descartados.

Mapeamento estudado: `external_product_identities` ancora Merchant Product;
`products.main_name` fornece título; `brands.name` fornece marca mediante FK;
`commerce_providers`, `commerce_merchants`, `commerce_feeds` validam origem;
`product_variants` fornece observações por product/provider/merchant. IDs e relações
inconsistentes causam falha local, nunca correção automática ou escrita.

O adapter mantém título/marca como evidência padrão. GTIN e MPN entram no parser
somente com `selectedVariantId` explícito e associação unívoca. `product_variants`
não possui sistema de tamanho: o adapter não inventa BR/EU, não converte EAN/UPC
em GTIN silenciosamente e não agrega cores/tamanhos ao título. O DTO permite tamanho
com sistema para futuros adapters que tenham essa evidência. A V1.2 valida GTIN.

Duas identidades para o mesmo product/provider/merchant no lote geram
`VARIANT_ASSOCIATION_AMBIGUOUS`; nenhuma variante é atribuída e uma seleção explícita
nesse caso falha. O input deve incluir todas as identidades relevantes desse trio:
o adapter local não consegue provar cardinalidade fora da coorte recebida.
Não aceita linhas repetidas de joins como Merchant Products distintos.

`offers` permanece preço, desconto, estoque, URL e evidência comercial próprios.
Foi inspecionado junto de `catalog_search_products`, seu builder/repository e os
handlers públicos. Nenhum deles é fonte primária de identidade. Não há Product
Family, `master_variants`, fusão de products, deduplicação de SKUs, troca de PK
ou reparenting de offers.

## Snapshot, hashes e reprodução

`inputHash = SHA-256(canonical({ version: snapshotVersion, input }))`.
A canonicalização ordena chaves de objetos por comparação de código, sem locale;
a ordem significativa de arrays é preservada. Variantes/provenance/diagnósticos
são ordenados explicitamente no snapshot. O relatório preserva os inputs exatos
para reproduzir parse e decisão.

Preço, desconto, estoque, URL, IDs de ofertas e datas operacionais não entram
nesse hash. Nome, marca e atributos permitidos enviados ao parser entram. Modelo,
geração e edição alteram o hash quando expressos no título. Campos que a V1.2
não consome não são artificialmente anexados ao título.

`inputManifestHash` combina chaves de origem, hashes e escopos ordenados.
`runKey` combina manifesto + todas as versões + configuração. Nenhum hash é PK
ou prova de identidade de Master. IDs `shadow-<digest dos membros>` são símbolos
locais do relatório e não são chaves persistentes de domínio.

Mesmo input, versões e configuração produzem os mesmos snapshots, candidatos,
decisões, grupos e `logical`. `measurements` fica separado e pode variar. Alterar
timestamps de origem altera a evidência auditável preservada no snapshot, mas
não muda inputHash, runKey, candidatos ou decisões. O tempo da execução não entra
em `logical`.

## Candidatos e limites

Versão `brand-type-token-dice-v1`:

1. Blocos por marca reconhecida no parse; sem marca fica fora da recuperação.
2. Comparações entre origens distintas `(providerId, merchantId)`; tipos conhecidos
   incompatíveis são excluídos. Tipo ausente não é inventado.
3. Dice dos conjuntos de tokens normalizados do título, limiar padrão **0,35**.
4. Ordenação por score decrescente, com chave de par como desempate.
5. Aceitação gulosa com grau máximo **5 por produto**, aplicada inclusive a exatos.

Essa configuração é da recuperação, não do matcher. Nenhum threshold, regra,
vocabulário ou label V1.2 foi alterado. Nomes de merchants não participam das chaves.
A mesma loja em providers diferentes não é canonicalizada como merchant físico.

Limites: 2.000 Merchant Products por execução; 1.000 variantes por registro;
100.000 comparações de recuperação e 20.000 avaliações únicas por padrão.
CLI aceita arquivo local de até 16 MiB. Configuração inválida falha localmente.
A recuperação percorre pares dentro dos blocos: custo quadrático limitado pela
coorte; o limite de score não elimina a enumeração de pares restantes para contagem.
Não é solução de escala para o catálogo inteiro.

O relatório distingue candidatos retidos, candidatos descartados por limite,
pares não examinados e pares não avaliados. `coverageLimited` sinaliza limites.
`COMPLETE` significa que a execução terminou; não afirma busca exaustiva.
Produtos sem candidatos aparecem com motivo: marca ausente, limite, recuperação
incompleta ou ausência nos blocos pesquisados. Nunca recebem NO_MATCH universal.

## Decisões e agrupamento

Master e Variant mantêm decisões, confidences, reasons e conflicts independentes.
A decisão de Variant é relativa ao escopo observado (título ou variante selecionada),
não à união de todos os SKUs de um Merchant Product.

`complete-pair-check-v1` começa com singletons e processa arestas Master AUTO_MATCH
em ordem canônica. Cada proposta de junção verifica todos os pares entre os dois
grupos. Pares ainda não avaliados são enviados ao mesmo matcher, com propósito
`GROUP_VERIFICATION`, e também entram nas métricas de decisões.

Se qualquer par resultar REVIEW, NO_MATCH ou não puder ser avaliado por limite,
a proposta é recusada e registrada. Grupos menores já verificados podem permanecer;
uma recusa não coloca seus membros em quarentena comercial. Não há connected
components/union-find irrestrito. Variant NO_MATCH não impede grupo Master e
jamais afeta publicação. Não há transferência de atributos ou ofertas.

A regra atual de Master AUTO_MATCH V1.2 é estruturalmente transitiva nos inputs
considerados. Por isso o teste de A–B–C usa um grafo adversarial sintético no
componente de agrupamento; o runner de produção não permite injetar outro matcher.
O teste obriga a consulta A–C e verifica recusa por REVIEW, NO_MATCH e orçamento.

## Invariantes comerciais

O teste de isolamento executa o **builder real** e os **handlers públicos reais**
com repository em memória e compara o resultado integral antes/depois do Shadow:

- elegibilidade e disponibilidade;
- preços atual/anterior, descontos e oferta representativa entre duas ofertas;
- URL pública de oferta, detalhe e redirecionamento;
- três páginas, contagens, facetas e filtros encaminhados ao repository;
- promoção válida com AUTO_MATCH, REVIEW, NO_MATCH e sem candidato;
- AUTO_MATCH sem promoção válida continua fora da projeção;
- exception, input inválido, recuperação vazia e limites esgotados.

A fonte comercial também é comparada antes/depois para detectar mutação. Nenhum
arquivo comercial foi modificado. O teste não usa PostgreSQL real: a semântica
SQL completa de filtros/ranking está fora dessa prova local. Testes existentes
do repository também foram executados. Não se alega validação de catálogo vivo.

## Cenários adversariais

Os 22 testes novos cobrem os 18 cenários da missão: singleton; mesmo Master em
duas/três lojas; Variant diferente; REVIEW; NO_MATCH; sem candidato; vários candidatos;
A–B–C; ID externo igual entre providers; atributos ausentes; alteração comercial;
alteração de identidade; edição funcional; números adicionais V1.2; determinismo;
limites/truncamento; e falha sem impacto comercial.

Também cobrem datas reais de entidades, ordem dos registros/chaves/variantes,
provenance, relações inválidas, input duplicado, tamanho de lote e associação ambígua.
Adizero EVO SL com ordem editorial equivalente resulta em Master AUTO_MATCH;
Woven Audi Revolut F1 Team fica REVIEW contra o modelo básico. Editorial desconhecido
continua REVIEW. A implementação não contém regra especial de marca.

## Relatório e métricas

[Relatório completo da fixture](validation/shadow-v1-fixture-report.json).
Amostra **sintética**, não uma contagem do catálogo real:

| Métrica | Resultado |
| --- | ---: |
| Merchant Products / providers / merchants | 12 / 2 / 3 |
| Produtos com / sem candidato | 10 / 2 |
| Candidatos / pares avaliados | 12 / 12 |
| Master AUTO_MATCH / REVIEW / NO_MATCH | 4 / 5 / 3 |
| Variant AUTO_MATCH / REVIEW / NO_MATCH | 2 / 4 / 6 |
| Grupos com vários membros / singletons | 2 / 7 |
| Conflitos de grupo | 0 |
| Candidatos truncados / pares não examinados / não avaliados | 0 / 0 / 0 |
| Tempo registrado | 7,554 ms |
| Variação de heap registrada | 856.856 bytes |

Tempo mede o runner, sem leitura do arquivo e sem adapter. Heap é variação do
processo, não pico de memória; pode ser negativo em outra execução devido ao GC.
Conflitos e truncamento não aparecem nessa coorte padrão, mas são exercitados
explicitamente nos testes adversariais.

Versões registradas: `reconciled-entities-v1`, `identity-input-v1`,
`brand-type-token-dice-v1`, parser/matcher `product-identity-v1.2` e
`complete-pair-check-v1`.

**Cobertura de Identity** conta candidatos/decisões desta coorte e deste gerador.
**Cobertura promocional** é `NOT_MEASURED`: Identity não calcula elegibilidade nem
pode estimar quantas oportunidades seriam publicáveis. Nenhuma precisão global
é calculada a partir do golden.

Controle histórico separado: os **247 pares reais armazenados** foram reproduzidos
nos testes com seus inputs originais, confirmando 147 AUTO_MATCH, 64 REVIEW e
36 NO_MATCH de Master. Esses dados não têm todas as entidades reconciliadas do
adapter; não foram inventados IDs de provider/feed/identidade externa para fazê-los
passar por uma coorte operacional. A coorte histórica integral de 16.978 produtos
não está disponível localmente e não foi consultada no banco.

## Reprodução local

```bash
# JSON puro em stdout; nenhuma persistência automática
node --import tsx scripts/product-identity-shadow.ts --fixture
npm run identity:shadow -- --fixture

# Array de entidades reconciliadas conforme reconciledRowSchema
node --import tsx scripts/product-identity-shadow.ts /caminho/entrada-local.json

# Testes novos com subtestes visíveis
node --import tsx --test --test-isolation=none \
  server/productIdentity/shadow.test.ts \
  server/productIdentity/commercialIsolation.test.ts

npm run check -- --incremental false
npm run test:product-identity
```

Para comparar relatórios, comparar `logical`; tempo/memória variam. O JSON incluído
foi produzido pelo CLI com `--fixture`, sem conexão, credencial ou importação de feed.

## Validações executadas

| Verificação | Resultado |
| --- | --- |
| Novos testes focados | 22 passaram, nenhuma falha/cancelamento |
| V1.2 + auditoria offline + Shadow + builder/repository + política/handlers públicos, com `--test-isolation=none` | 154 passaram, nenhuma falha/cancelamento |
| `npm run check -- --incremental false` | Passou, código 0, após as alterações finais |
| `npm run build` | Passou, código 0; aviso Vite de chunk maior que 500 kB |
| `npm run test:unit` | Iniciada e interrompida sem conclusão após permanecer pendente na suíte HTTP |
| Diagnóstico `timeout 20s node --import tsx --test --test-isolation=none server/auth/routes.test.ts` | Limitação ambiental: `listen EPERM: operation not permitted 127.0.0.1`; timeout 124, 11 testes cancelados |
| Hashes dos cinco artefatos V1.2 | Idênticos à base e ao registro V1.2; verificados pelo teste |
| Relatório fixture / determinismo | Gerado localmente; comparação de `logical` reproduzível |
| `git diff --check`, incluindo arquivos novos com `--no-index` | Sem erros de whitespace |

Nenhum teste foi alterado para contornar permissões. Não foram executados Playwright,
regressão com servidor ou consultas ao banco. UI, navegação e pipeline comercial não
foram modificados. A suíte unitária completa continua sendo uma verificação pendente
em ambiente com bind permitido.

## Riscos, limitações e próximos passos

- Títulos incompletos continuam sujeitos às limitações conservadoras da V1.2.
  Similaridade limita recall e não comprova equivalência comercial.
- Coorte limitada, bloqueio por marca/tipo e teto por produto podem perder candidatos.
  A ordenação determinística não garante distribuição equitativa entre merchants.
- A cardinalidade fora do lote não é verificada; um futuro repository deverá ler
  associações completas e selecionar evidência de origem de forma explícita.
- O adapter atual usa `products`/`brands`; não resolve conflitos de raw entre feeds,
  não escolhe automaticamente a evidência mais recente e não transfere metadados.
- Grupos são simulações locais. Não representam Master persistido e não autorizam
  deduplicação. Variant AUTO_MATCH não prova SKU físico quando faltam atributos.
- Falhas retornam código sanitizado genérico; diagnóstico detalhado de origem exigirá
  contrato próprio antes de uma execução operacional agendada.
- Próxima etapa: revisar contratos e limites, validar uma coorte reconciliada real
  somente leitura e medir custo. Persistência de decisões/Masters depende de outra
  missão. O Shadow não introduz dependência de identidade na publicação.

Banco alterado: NÃO. Migration criada: NÃO. Schema alterado: NÃO.
Pipeline comercial alterado: NÃO. Catálogo alterado: NÃO. Publicação alterada: NÃO.
Parser alterado: NÃO. Matcher alterado: NÃO. Golden dataset alterado: NÃO.
Human labels alterados: NÃO. Importação executada: NÃO.
Commit: NÃO. Push: NÃO. Merge: NÃO. Deploy: NÃO.

**PRODUCT IDENTITY V1.3 SHADOW APROVADO PARA REVISÃO**

Escopo local implementado e verificado; revisão deve considerar as limitações
ambientais da suíte completa e a ausência de auditoria em banco real.
