# Product Identity V1.1 — Produto Mestre, Variante e Oferta

`parseProductIdentity(input)` → `matchProductIdentities(left, right)`.
São funções puras, determinísticas e independentes de marketplace. Não acessam
banco, rede, preço, elegibilidade ou catálogo público. Não persistem resultados.

**Produto Mestre != Variante != Oferta.** O mestre representa marca, modelo/família,
geração, tipo de produto e qualificadores estruturais. A variante descreve cor,
audience, tamanho e identificadores disponíveis dentro desse mestre. Oferta é um
registro comercial de um vendedor/marketplace; não é criada ou identificada por
este módulo. Várias ofertas e variantes podem compartilhar um mestre.

## API e compatibilidade

```ts
const a = parseProductIdentity({ name: "Tênis New Balance Rebel V5 Preto" });
const b = parseProductIdentity({ name: "Tênis New Balance Rebel V5 Verde" });
const result = matchProductIdentities(a, b);
// result.masterDecision === "AUTO_MATCH"
// result.variantDecision === "NO_MATCH"
// result.master / result.variant: { decision, confidence, reasons, conflicts }
```

O parser expõe `master`, `variant`, `raw`, `normalizedTokens` e ambiguidades.
Preserva também os campos planos V1 para consumidores existentes. `raw` contém
uma cópia do input, inclusive tamanho e identificadores fornecidos. Não preencher
campos desconhecidos por inferência. Marca estruturada aceita qualquer marca;
a lista de marcas conhecidas é apenas uma ajuda para extrair marca do título.

O matcher acrescenta `masterDecision`, `variantDecision`, `masterConfidence` e
`variantConfidence`. As decisões em ambos os níveis são `AUTO_MATCH`, `REVIEW`
ou `NO_MATCH`. Os campos legados `decision`, `reasons`, `conflicts` continuam
referentes exclusivamente ao mestre. `confidence` legado mantém a escala V1
(0 para incompatibilidade, 0.5 para revisão e 0.95 para match).
Os objetos devem vir do parser; literais manuais do antigo tipo precisam incluir
os novos campos. Não existe integração deste contrato com APIs públicas.

## Parser

Reutiliza `normalizeAttributeText` e `COLOR_DICTIONARY`; não altera taxonomia.
O tokenizer específico preserva versões decimais. Modelo é um multiconjunto
ordenado de tokens: não elimina palavras desconhecidas nem repetições.

`IDENTITY_COLOR_ALIASES` estende o dicionário apenas neste módulo com descritores
como coral, chalk e sand. Para estender, adicionar vocabulário explícito e testes;
não descartar palavras desconhecidas. Descritores precisos não são convertidos
arbitrariamente em cores amplas (sand não equivale automaticamente a bege).
Somente sufixos são extraídos. Um descritor novo antes de uma cor já extraída
exige separador explícito, como `e` ou `/`; sem ele, conserva-se o token e registra-se
`COLOR_MODEL_BOUNDARY_UNCERTAIN`. Assim `Easy Sand Cinza` não vira `Easy`, enquanto
`Chalk/Chalk/Sand` é reconhecido. Palavras internas, como `Sand Quantumweave`,
permanecem modelo. Cores desconhecidas permanecem nos tokens e podem exigir revisão.

Vn e versões decimais mantêm a normalização V1. Algarismos romanos com várias letras
mantêm independência de ordem (`Club Era II` / `Club II Era`). Letras romanas isoladas
internas permanecem modelo: `Fresh Foam X 880 V15` tem versão 15, não versões 10 e 15.
Inteiros soltos são gerações apenas para famílias explicitamente revisadas;
480, 1080, 1000 e 300 continuam números de modelo. Gerações múltiplas exigem revisão.

Audience conserva gênero e faixa etária, inclusive `BABY` além de `INFANTIL`;
menino/menina preservam gênero. Ausência de informação nunca implica adulto,
masculino, feminino ou unissex. Tamanho estruturado exige `{ value, system }`.
Tamanho com rótulo no título é removido do modelo, mas permanece raw e exige revisão
por falta de sistema confiável. Números sem rótulo não são tratados como tamanho.

## Matcher e confidence

Conflitos de marca, tipo, geração, número de modelo e qualificadores incompatíveis
continuam impedindo master AUTO_MATCH. Marca sozinha e descritores genéricos não
identificam produto. Tokens diferentes, evidência unilateral ou parsing ambíguo
exigem revisão. Similaridade textual nunca decide identidade.

A variante exige mestre confirmado e evidência compatível. Cores explícitas
sem interseção conflitam; sobreposição parcial (`branco` / `branco e preto`)
exige revisão, assim como cor ausente. Audience conhecida em apenas um lado
exige revisão; gêneros explícitos incompatíveis conflitam. Tamanhos diferentes
no mesmo sistema conflitam; sistemas diferentes exigem revisão, sem conversão.
Um mestre incompatível implica variante incompatível. Um mestre em revisão nunca
produz variante automática, embora um conflito de cor possa rejeitar a variante.

| Exemplo | Mestre | Variante |
| --- | --- | --- |
| Aramis Daily Slip Canvas verde / preto | AUTO_MATCH | NO_MATCH |
| Rebel V5 preto / feminino preto | AUTO_MATCH | REVIEW |
| 413 V3 masculino / feminino | AUTO_MATCH | NO_MATCH |
| Bibi Roller 2.0 preto / preto | AUTO_MATCH | AUTO_MATCH |
| Bibi Roller 2.0 preto / cor ausente | AUTO_MATCH | REVIEW |
| Penalty Max 1000 / Max 300 | NO_MATCH | NO_MATCH |
| Klin Freestyle infantil / infantil baby, mesma cor | AUTO_MATCH | REVIEW |

Sem GTIN, variante AUTO_MATCH significa **igualdade dos atributos observados**,
não comprovação de SKU vendável. Exige cor conhecida e igual. Audience/tamanho
ausentes nos dois lados não comprovam igualdade desses atributos; o resultado
explicita `UNOBSERVED_ATTRIBUTES_NOT_PROVEN`. Isso permite o controle Bibi solicitado
sem inventar gênero ou tamanho. Não usar esse resultado para fundir ofertas.

GTIN aceita EAN/UPC em `gtin`, valida comprimento e dígito verificador e normaliza
para 14 dígitos. Igualdade pode suprir atributos ausentes, mas não sobrepõe conflitos,
parsing ambíguo ou mestre não confirmado. GTIN diferente impede igualdade de variante.
`mpn` é exclusivamente código de fabricante dentro da marca: igualdade é evidência
adicional, diferença exige revisão e igualdade isolada não comprova variante.
SKU de merchant, AWIN product ID e IDs de oferta não são evidência cross-merchant.
A auditoria atual só lê título/marca/IDs de registro; não pressupõe GTIN ou MPN.

As novas confidences representam força heurística da **decisão correspondente**:
0.95 para mestre automático, 0.85 para variante com atributos observados iguais,
0.98 com GTIN igual, 0.99 para rejeição explícita e 0.5 para revisão. São constantes
ordinais de política, **não probabilidades, precisão medida ou percentuais de acerto**.
Uma variante rejeitada com 0.99 indica confiança na rejeição, não na igualdade.

## Auditoria somente leitura

```bash
node --import tsx scripts/product-identity-offline-evaluation.ts
node --import tsx scripts/product-identity-offline-evaluation.ts --detailed
```

Usa `AWIN_CURATOR_DATABASE_URL` ou `DATABASE_URL`, sem imprimir segredos.
Abre `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, verifica
`transaction_read_only=on`, faz SELECT e ROLLBACK. Não escreve resultados no banco.
Saída padrão é JSON resumido, com contagens e 20 pares de cada uma das quatro
categorias de segurança, quando disponíveis. Amostragem ordenada por SHA-256 de
marca + IDs do par é determinística e independe da ordem das linhas. Todos contêm
nomes, marca, decisões, confidences, reasons e conflicts. `--detailed` inclui os pares
completos; `evaluate(rows)` mantém a API detalhada V1 e `summarize(report)` a resume.

Geração de candidatos permanece: mesma brand_normalized, Dice de trigramas,
limiar 0.55, topK 5 para não exatos. Controle exato mantém todos os pares.
Limites de candidatos restringem recall. Nenhuma dessas regras depende do matcher.

`identityV11` contém decisões por nível, por marca e por coorte, mestre automático
com variante em revisão/rejeitada, multiplicidade por registro e por assinatura
estrutural, além de duplicidades aparentes por merchant. `masterIdentityKey` ignora
variantes, mas é assinatura de evidência, não ID persistente nem prova de identidade.
A contagem de mestres únicos considera apenas candidatos AUTO_MATCH. Como esse
matcher exige assinatura estrutural igual, zero casos com múltiplas assinaturas
nessa coorte é consequência da política, não prova de ausência de ambiguidade real.
Duplicidades exigem atributos observados equivalentes e automatch consigo mesmas;
podem representar SKUs/tamanhos omitidos, portanto nenhuma exclusão é autorizada.

O controle positivo compara os agregados com 554/9/0 e sinaliza queda de AUTO_MATCH,
novos NO_MATCH ou universo alterado. A comparação agregada não substitui revisão
individual das transições. Resultados da execução desta missão: [AUDIT-V1.1.md](AUDIT-V1.1.md).

## Validação e limites

`npm run test:product-identity` executa identidade e auditoria; ambos também estão
em `test:unit`. No ambiente Node 24 desta missão, executar com
`node --import tsx --test --test-isolation=none ...` expôs todos os subtestes,
enquanto o isolamento padrão reportava apenas os arquivos.

Não há ground truth rotulado nem taxa medida de falsos positivos. Títulos podem
omitir material, largura, tamanho, público ou edição. Vocabulário de cores,
marcas e audience não é exaustivo; termos que também nomeiam modelos continuam
ambíguos. Romanos e decimais são heurísticas, não uma base de modelos do fabricante.
Qualificadores V1 (inclusive PS/JR) continuam estruturais por compatibilidade.
Essa prova local não autoriza persistência, fusão de produtos, deduplicação,
mudanças em ofertas ou publicação. A próxima etapa é validação rotulada dos pares.
