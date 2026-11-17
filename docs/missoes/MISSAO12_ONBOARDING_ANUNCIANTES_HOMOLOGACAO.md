# Missão 12 — Adicionar anunciantes AWIN no ambiente de homologação

Data de planejamento: 2026-11-17. **Não autoriza deploy de produção, importação massiva ou pesquisas pagas.**

## Contexto e decisão do produto
- Preparar UpPulse comercial V1 sem a Ficha Inteligente, preservando filtros, organizador, catálogo real, preços e links de ofertas.
- A Ficha Inteligente fica desativada na interface por padrão (commit `9842e50055468db8161666b2106761e9d7e44535`); seu código e os dados de identidade não são apagados.
- Manter catálogo DEMO do Mercado Livre isolado; somente os feeds oficiais aprovados entram na homologação operacional.
- Catálogo existente: Dafiti + FutFanatics, com 32.707 produtos, 96.851 ofertas e 16.945 linhas de projeção na conferência de 2026-11-17; não alterar esse baseline antes do inventário.

## Novo anunciante candidato
- Olympikus BR: programa público AWIN identificável pelo perfil de anunciante 17698, **sem inferir** que esteja aprovado na conta do proprietário, que possua feed acessível ou que tenha produtos elegíveis hoje.
- Inventariar outros anunciantes realmente habilitados na conta AWIN do titular, obtendo identificador de anunciante, ID do feed, nome e data de atualização. Não copiar credenciais ou URL com token para documentação.
- O cadastro de marcas como `Olympikus` não se confunde com cadastro de anunciante: um feed de um parceiro pode conter várias marcas.

## Etapas seguras
1. Inspecionar status de aprovação dos programas AWIN e os feeds acessíveis na conta autenticada. Fazer a autenticação exclusivamente por segredo no ambiente; nunca exibir token, senha ou URL assinada em log, Issue, commit ou chat.
2. Verificar formatos e tamanhos dos feeds, estimar volume e selecionar uma fonte por vez. Registrar somente nome, merchant_id, feed_id, contagem, última atualização e erros sanitizados.
3. Usar pipeline existente: `npm run awin:dry-run -- --file <arquivo.csv.gz>` ou `npm run awin:import -- --file <arquivo.csv.gz> --mode=dry-run --merchant=<id> --expected-count=<n> --feed-id=<id>`, após inspecionar opções efetivas. Sem novas gravações nessa etapa.
4. Fazer auditoria de classificação de tênis, ofertas, descontos válidos, disponibilidade, imagens, URLs afiliadas e taxa de duplicidade; rejeitar registros não elegíveis.
5. Projetar comparação multi-loja no Product Identity Master em modo sombra: medir mesmo modelo com ofertas de múltiplos parceiros, cobertura, falsos positivos, variantes e casos `NO_MATCH`/`REVIEW`. **Nunca fazer fusão automática** diante de conflito ou revisão humana negativa.
6. Antes de persistência em staging, confirmar backup/rollback, banco e esquemas corretos, índices, impacto esperado e autorização explícita separada. Nunca executar `db:push` indiscriminadamente.
7. Validar interface com várias lojas: busca, filtros, agrupamento, marca, tamanho, preço, maior desconto e links afiliados. Regressão de testes e preview isolado por SHA; não substituir 5011/5013 automaticamente.
8. Homologar lote novo e somente depois avaliar liberação comercial; produção Hostinger possui outro gate.

## Saídas esperadas
- Inventário sanitizado das fontes AWIN efetivamente acessíveis, com status de aprovação e feed disponível.
- Dry-run e métricas de classificação e elegibilidade por anunciante.
- Relatório de identidade Master e propostas de agrupamento sem mutação comercial.
- Testes executados, SHA, URL de preview, riscos e próximos passos.
- Atualização da documentação operacional canônica, distinguindo `IMPLEMENTADO`, `TESTADO`, `HOMOLOGADO` e `PUBLICADO`.

## Bloqueios de acesso
O conector GitHub do ChatGPT **não é** uma sessão autenticada na conta AWIN. Sem credencial já configurada e feed acessível, não se pode afirmar que novos programas foram conectados nem importar seus dados. O usuário poderá habilitar acesso seguro no Codespaces ou fornecer apenas os identificadores públicos/relatório sanitizado de feeds; nunca compartilhar segredo no chat.
