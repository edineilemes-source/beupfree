# Missão 11.6 — Ficha Inteligente de leitura (síntese + fontes + auditoria)

**Estado:** implementação disponível na branch `feat/uppulse-missao10-supercatalogo`; execução de testes e preview no Codespaces **pendente**.

## Decisão de produto
O usuário aprovou uma ficha em linguagem natural, inspirada na apresentação de respostas das IAs:
1. Síntese curta do produto, somente a partir de informações sustentadas por evidências.
2. Características técnicas consolidadas com marcadores azuis discretos de referências `[1]`, `[2]` (até duas por linha); não repetir dez parágrafos por dez fontes.
3. Alternativas reais visíveis: por exemplo `Drop: 6 mm ou 6,5 mm` sem determinar o correto pela maioria. Fonte oficial recebe prioridade na seleção dos links apresentados, **não** autoridade automática para ocultar divergências.
4. Material ou descrições sem equivalência segura continuam distintos; evitar reescrita que possa confundir versão, numeração e variante.
5. Área expansível `Ver todas as fontes e detalhes técnicos` mantém textos originais por fonte, URLs, datas, status e todas as referências, incluindo fontes não citadas no resumo.
6. Nenhum dado inventado em fichas `IDENTITY_ONLY`. Valores reaproveitados da base de evidências existente.

## Implementação
- `server/productIntelligence/customerKnowledge.ts`: modelo de apresentação determinístico, grupos técnicos, fraseado restrito a atributos disponíveis, links limitados por campo; não usa IA paga.
- `client/src/components/IntelligentProductCard.tsx`: ficha do consumidor com síntese, tabela legível, pequenos números azuis clicáveis e painel de auditoria em `details`.
- `client/src/components/ProductKnowledge.tsx`: usa a mesma apresentação em produtos comerciais consultados do catálogo; hashes e chaves técnicas ficam recolhidos em `Identificadores internos`.
- `client/src/components/EvoSlPilot.tsx`: na pesquisa real V2, exibe a nova ficha com evidências do relatório `/tmp/uppulse-evo-sl-real-research-v2.json`. Logs e dados da pesquisa original ficam recolhidos.
- `server/productIntelligence/reportReconciliation.ts`: mantém o `sourceType` existente, sem declarar automaticamente qualquer site como auditoria independente.
- `server/productIntelligence/customerKnowledge.test.ts`: testes de alternativas reais, preservação de dez fontes no relatório com duas citações por característica, prioridade de link da fabricante, ausência de dados inventados.
- `tests/e2e/ai/consultor-ficha.spec.ts`: novo teste Playwright da ficha narrativa e abertura da auditoria a partir do relatório V2 simulado.
- `scripts/mission11-6-intelligent-card-preview.sh`: compila, executa testes específicos, lê exclusivamente o relatório V2 já obtido e abre preview isolado na **porta 5009**, com Playwright direcionado. Não executa Tavily/OpenAI e não altera tabelas comerciais.

## Restrições de homologação
- O relatório V2 tem **10 campos**, **3 sites técnicos** e **6 conflitos brutos**; normalização conservadora identifica consensos parciais sem apagar divergências reais.
- Uma síntese textual determinística não equivale a um novo resumo gerado pela OpenAI; esta versão evita custos e alucinações. A evolução futura poderá empregar síntese de linguagem por IA com referências verificáveis e limites próprios.
- O `masterId` do endpoint operacional de conhecimento ainda deriva do `product_id` consultado, não do Master confirmado: antes de gravar ou publicar inteligência em escala, alinhar a chave ao Master real e validar variantes.
- Os dados de laboratório Evo SL continuam **experimentais**, não aprovados comercialmente. Nada foi publicado na Hostinger; testes executados pelo usuário ainda necessários.

## Execução em Codespaces
```bash
cd /workspaces/uppulse-homologacao/missao9/codigo || exit 1
git fetch origin feat/uppulse-missao10-supercatalogo &&
git show origin/feat/uppulse-missao10-supercatalogo:scripts/mission11-6-intelligent-card-preview.sh | bash
```
Acesse PORTS 5009 → Ficha inteligente e fornecedores → Ver IA real — rodada 2.

## Correção após primeira validação Codespaces (2026-11-16)
- O usuário executou `scripts/mission11-6-intelligent-card-preview.sh` na fonte `abb031e`; `npm run check` identificou `TS18048`: propriedade opcional `field.agreements` acessada diretamente em `EvoSlPilot.tsx` linha 68.
- Corrigido em `aa2ccd8` com fallback `(field.agreements ?? [])`, sem alterar dados, fontes ou cálculos.
- Revisados também dois testes Playwright preexistentes que procuravam SuperHash visível. Como a nova ficha recolhe os identificadores internos, os testes agora expandem a seção antes de verificá-los; a mensagem de ficha sem evidências foi atualizada.
- A primeira execução **não chegou aos testes nem ao preview**; a correção publicada **ainda precisa ser validada novamente no Codespaces**. Nenhuma chamada Tavily/OpenAI foi iniciada.
