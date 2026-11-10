# Missão 11 — Retomar a aplicação e evoluir o catálogo (prioridade de produto)

Data: 2026-11-10. Repositório: `edineilemes-source/beupfree`. Branch de referência: `feat/uppulse-missao10-supercatalogo`.

## Objetivo de negócio

Voltar a **abrir, navegar e validar a aplicação UpPulse com produtos reais**, preparar a entrada de novos parceiros e evoluir o layout aprovado. Não transformar a Missão 10.6 em bloqueio geral da aplicação. Inteligência artificial continua como módulo opcional, desabilitado para chamadas pagas até homologação.

## Evidência de partida

- GitHub: relatório documental da Missão 10.6 publicado em `51cafac` e corrigido posteriormente; **implementação 10.6 ainda local no Codespaces**.
- Banco de referência documentado: `uppulse_catalog`, Docker `beupfree-catalog-pg17`, porta local 5435. Contagens da última verificação, não atuais: 32.707 produtos, 96.851 ofertas, 16.945 registros na projeção de busca.
- Stack: React/Vite, Express/TypeScript, PostgreSQL/Drizzle; `npm run dev`, `npm run check`, `npm run test:unit`, `npm run build`, testes Playwright.
- Existem alterações não commitadas da Missão 10.6 no checkout principal e um commit documental local divergente (`322ed89`). Não usar reset, rebase com working tree suja, stash ou force-push. O remoto tem os documentos publicados. Não sobrescrever o código local.
- Os scripts e diretórios legados do `AGENTS.md` são históricos; identificar primeiro o comando de inicialização correto no checkout efetivo.

## Execução única e pragmática (sem retrabalho administrativo)

1. **Preservação:** diagnosticar branch, HEAD, remotos, worktrees, status e processos/portas; registrar resultado. Não limpar `.cache/`, dados, volumes ou arquivos não rastreados. Resolver a divergência de histórico apenas por estratégia comprovadamente não destrutiva, sem bloquear a inicialização da aplicação. Não commitar código 10.6 por engano.
2. **Aplicação no ar:** localizar o entrypoint real, checar dependências e banco existente, iniciar/reutilizar o servidor no Codespaces sem matar processos alheios; identificar porta, URL de preview e HTTP real. Se banco estiver indisponível, explicar bloqueio preciso, sem inventar conexão. Não abrir deploy Hostinger.
3. **Validação funcional:** navegar catálogo, busca, filtros, organizador, detalhes, imagens, ofertas, preços, links afiliados e responsividade. Validar no mínimo uma amostra real de Dafiti e FutFanatics; separar catálogo operacional de dados DEMO do Mercado Livre. Registrar problemas reproduzíveis, com evidências e prioridade.
4. **Correções essenciais:** implementar e testar as menores correções necessárias para o catálogo abrir e funcionar; preservar produto ≠ oferta, identidade Master, agrupamentos, descontos válidos e regras de publicação. Não refazer layout já aprovado sem verificar referência existente.
5. **Novos parceiros:** identificar adaptadores e pipeline `Coletar → Processar → Triar → Publicar`; entregar uma interface/checklist de integração multi-marketplace reutilizável e indicar claramente quais credenciais/feeds são necessários. Não importar feeds reais sem autorização e validação de origem, elegibilidade e custos.
6. **Layout:** comparar a tela existente com os previews e decisões aprovados do projeto; corrigir regressões de maior impacto e preparar uma proposta objetiva de próxima iteração visual, sem substituir unilateralmente a identidade UpPulse.
7. **IA:** manter a inteligência de produto desacoplada do caminho crítico do catálogo; confirmar que a aplicação funciona com `RESEARCH_PAID_ENABLED` e `RESEARCH_POSTGRES_HOMOLOGATED` desabilitados. Não executar migração 10.6, chamadas pagas ou pesquisa automática.
8. **Testes e entrega:** executar `npm run check`, testes direcionados, build e Playwright do fluxo de catálogo quando o ambiente permitir. Registrar somente resultados executados. Não desabilitar testes para obter sucesso. Gerar relatório em `docs/relatorios/MISSAO11_RETOMADA_APLICACAO_CATALOGO_LAYOUT.md` com URL/porta comprovadas, bugs corrigidos, amostras de catálogo, testes, limitações e próximas ações. Atualizar `docs/ESTADO_OPERACIONAL.md` e `.ai/NEXT_ACTION.md`.

## Critérios de conclusão

- Aplicação acessível no preview do Codespaces, ou bloqueio ambiental exato documentado.
- Fluxo catálogo → filtro → produto → oferta demonstrado com dados reais, sem confundir DEMO.
- Problemas de layout e importação priorizados para avançar no negócio.
- Nenhum dado comercial perdido, nenhuma migração aplicada, nenhuma API paga acionada.
- Relatório e documentação publicados no GitHub, com confirmação do SHA remoto. Se a execução não conseguir publicar, não pedir repetidas cópias de logs; informar um único bloqueio concreto.
- Código alterado somente com revisão e publicação controlada, evitando misturar a implementação local 10.6 com correções da Missão 11.

## Limite de execução

O GitHub guarda código e documentação; não hospeda o banco Docker nem o processo HTTP do Codespaces. Verificações remotas não substituem o teste da aplicação em execução. Não declarar aplicação funcionando apenas porque o repositório está acessível.
