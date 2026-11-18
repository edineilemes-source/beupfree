# Olympikus BR — auditoria do feed e plano de integração regular-price

**Arquivo real da conversa:** `17698-51837-pt_BR-Default.csv.gz`; inspeção direta do conteúdo, não uma estimativa. **Não versionar feed bruto ou credenciais AWIN.**

## Identidade do fornecedor
- AWIN merchant ID `17698`, feed ID `51837`, moeda `BRL`. Todos os 7.140 registros exibem os valores esperados.
- 7.140 registros: 7.140 preços atuais positivos, 7.140 imagens principais, 7.140 links AWIN e 7.140 `in_stock=1` na captura.
- `product_price_old`, `rrp_price`, `saving`, `savings_percent`: vazios nos 7.140 registros. **Sem preço anterior comprovado, não há promoção comprovada.**
- `Fashion:size`: preenchido em 7.139; `size_stock_amount` não disponível.
- `product_GTIN`: 7.042 preenchidos e todos passaram a verificação estrutural de dígito de controle de GTIN; isso não prova equivalência de modelos entre lojas.
- `last_updated`: não preenchido; não presumir frescor a partir de data de importação.

## Universo e cardinalidade
- 5.127 nomes começam por `Tênis `; 5.224 **candidatos** de tênis pela regra exploratória de nome/categoria; 1.916 outros candidatos, incluindo roupas, chinelos e acessórios.
- 814 agrupamentos de tênis por `host + pathname` da página de origem (ignorando query de `idsku`); 696 têm mais de uma linha/variante. Grupos não são correspondências confirmadas de Produto Mestre.
- Preço mínimo geral do arquivo R$ 19,99, máximo R$ 1.999,99 (todos os tipos, não somente tênis).

## Revisão técnica das fases
| Fase | Estado | Artefato/risco |
|---|---|---|
| Parse CSV/GZIP e AWIN | Implementado | `normalize.ts`; adicional `Fashion:size` |
| Normalizar preço regular | Implementado e testado em fixture | `evaluateCommercialPrice`: regular, promoção comprovada, revisão |
| Classificar tênis e requisitos | Implementado e testado em fixture | `catalogCandidate.ts` e testes; auditor `awin-commercial-audit.ts` |
| Evidência comercial em banco | Migração 0014 preparada, **não aplicada** | Antigas constraints só aceitam descontos positivos |
| Publicação/classificação no banco | **Pendente** | `awin-dafiti-catalog-persist.ts` continua dependente de regra/promos e tem invariantes históricas exclusivas da Dafiti. Criar rotina genericamente multi-merchant, sem alterar a antiga |
| Projeção por loja | Código preparado, **não persistido** | `catalogSearchProjection/builder.ts`, persistência status, migração 0014 |
| Busca, filtros, cards | Código preparado e testes automatizados | API não exibe preço histórico fictício; filtro `Sem desconto`, preço e desconto |
| Produto Mestre cross-store | **Pendente evidência real** | Teste sintético de três fornecedores concluído, mas sem comparações reais de bases |
| Deploy Hostinger | **Não autorizado / não executado** | Requer gates próprios e teste real |

## Próxima execução segura
1. Colocar o feed no Codespaces em área de inbox não versionada; rodar `node --import tsx scripts/awin-commercial-audit.ts --file <path> --merchant 17698 --feed-id 51837` (leitura apenas). **O arquivo anexado ao chat não é automaticamente copiado ao Codespaces**.
2. Confrontar constraints do PostgreSQL de homologação e produzir backup/restauração testada antes de aplicar migração 0014. A migração não é gatilho de publicação.
3. Implementar persistência multi-merchant de evidência `REGULAR_PRICE`, com preço anterior bruto `NULL` preservado em proveniência e `previous=current` somente em camada de compatibilidade, status explícito.
4. Staging no merchant Olympikus isolado, sem ativar ofertas; comparar métricas e deduplicação; validar estágio e rollback.
5. Recompor projeção somente após aprovação específica e conferência de contagens; testar UI/links por preço e desconto; estimar matches do Produto Mestre.
6. Publicação somente após homologação completa. Manter 5013/Hostinger inalterados.

## Proteções
Nada deste relatório autoriza importar, deletar, resetar, rodar migração ou expor feed, tokens e links afiliados em issues. A auditoria direta neste documento é independente do classificador TS: a contagem de 5.224 não é número aprovado pelo sistema.
