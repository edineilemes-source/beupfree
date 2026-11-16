# Missão 11.7 — Ficha em página inteira, pt-BR e medidas brasileiras

Estado: **implementação publicada no GitHub; validação no Codespaces pendente**.

## Pedido aprovado
- Ao clicar em **Características do produto · Ficha inteligente**, abrir uma janela que ocupa praticamente a viewport inteira, com largura de leitura semelhante às páginas de lojas, e rolagem própria. Evitar modal de 640px.
- A ficha FINAL deve ter prioridade em relação a diagnósticos do laboratório.
- Traduzir para português brasileiro o texto do relatório real Evo SL V2; apresentar alturas/drop em **milímetros** e pesos em **gramas** (quilogramas quando pertinente), com vírgula decimal.
- Manter fontes clicáveis; preservar o texto original da extração na auditoria; não alterar Master, banco, valores extraídos, relatórios de pesquisa nem disparar Tavily/OpenAI.

## Implementação
- `MasterOffers.tsx`: modal de página inteira (`100dvh`, `100vw`), conteúdo responsivo central com largura de até `max-w-6xl` e título "Características e informações do produto".
- `EvoSlPilot.tsx`: ficha final V2 colocada antes dos diagnósticos; painel técnico de conciliação recolhido.
- `technicalPresentation.ts`: tradução controlada para os trechos reais de 10 características e seus valores do Evo SL; conversão numérica explícita oz→g, polegada→mm; mantém numerações **US** rotuladas como US, evitando confundir com numeração brasileira. O texto de origem **não é alterado**.
- `customerKnowledge.ts`: usa apenas a tradução na projeção visível ao cliente, preservando o campo original de evidências em inglês.
- `IntelligentProductCard.tsx`: auditoria exibe primeiro a tradução e, quando diferente, a redação original abaixo, além de data e URL.
- `technicalPresentation.test.ts`: testes de vocabulário do Evo SL, medidas, numeração e não alucinar tradução desconhecida.
- Teste Playwright existente em `tests/e2e/ai/consultor-ficha.spec.ts` ampliado para verificar dimensão do modal, entressola traduzida e peso em gramas.
- `scripts/mission11-7-ficha-fullscreen-ptbr.sh`: snapshot Git isolado, `npm run check`, testes focados, reconciliação offline e preview **porta 5010** com Playwright. Sem nova pesquisa paga nem escrita no catálogo.

## Limitações
- O tradutor de apresentação é **conservador e limitado às expressões técnicas conhecidas do relatório Evo SL**; expressões futuras desconhecidas permanecem no idioma original em vez de serem traduzidas incorretamente. Para catálogos novos, será necessária tradução estruturada na etapa de extração, com validação de conteúdo e preservação dos originais.
- A ficha Evo SL continua experimental; o relatório V2 mantém 6 conflitos e não deve ser promovido automaticamente a cadastro Master comercial.
- Não houve publicação na Hostinger. Nenhum teste da Missão 11.7 foi executado dentro do Codespaces por este agente.

## Próxima ação, uma única execução no Codespaces
```bash
cd /workspaces/uppulse-homologacao/missao9/codigo || exit 1
git fetch origin feat/uppulse-missao10-supercatalogo && \
git show origin/feat/uppulse-missao10-supercatalogo:scripts/mission11-7-ficha-fullscreen-ptbr.sh | bash
```
Se o comando retornar `FICHA_TELA_CHEIA_PTBR_OK`, abrir **PORTS 5010** e selecionar **Características do produto · Ficha inteligente → Ver IA real — rodada 2**.
