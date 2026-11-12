# Missão 11.1 — IA dupla integrada ao UpPulse

## Decisão do produto
Duas experiências complementares, ambas ancoradas no catálogo real:
1. **Consultor interno**, acionado na busca superior: conversa com o cliente, interpreta modalidade (corrida, caminhada, trilha), marca, orçamento, numeração e preferências; consulta SOMENTE produtos comerciais elegíveis e ofertas atuais; explica por que recomenda cada produto, apresenta alternativas e pergunta o que falta. Não inventa disponibilidade, desempenho técnico nem modelos. V1: motor determinístico e conversação guiada sem APIs externas. Modelo local opcional futuro, com governança de latência/recursos.
2. **Ficha inteligente**, aberta ao clicar no produto: apresenta Master ID, Family Key, Model Key, Variant Key, SuperHash, fornecedores, ofertas, características e evidências com fontes. Pesquisa externa manual/opt-in usa Tavily + OpenAI via adaptadores da Missão 10, persiste conhecimento no PostgreSQL e preserva status VERIFIED/SINGLE_SOURCE/CONFLICT/UNAVAILABLE. Chamadas pagas continuam DESLIGADAS até autorização, configuração de limites, homologação de recuperação de claims órfãs e proteção de endpoint.

## Regras obrigatórias
- Catálogo existente: `products`, `offers`, `catalog_search_products`, `product_intelligence_cache`, `research_claims`, `research_budget`.
- Produto mestre e ofertas são entidades diferentes. Recomendação precisa citar produto real, oferta válida, preço atual e URL de afiliado existente.
- Reutilizar `server/catalogSearchProjection/repository.ts` e seus critérios de `CATALOG_ELIGIBLE`, sem pesquisar diretamente dados de DEMO. Não supor que todos os 32.707 produtos são publicáveis.
- Reutilizar `server/productIntelligence/superCatalog.ts`, `research.ts`, `postgresResearch.ts`, `liveProvider.ts`; não duplicar inteligência nem sobrescrever dados comerciais com evidência externa.
- Fonte, data, grau de verificação, conflitos e vínculo ao modelo/variante obrigatórios. Não apresentar como verdade técnica o que não foi verificado.
- V1 consultor sem chamadas externas e sem prometer LLM local se não houver modelo instalado; identificar perguntas por regras e classificação, manter sessão temporária no cliente, oferecer perguntas de esclarecimento e links reais.
- Evitar recomendações médicas/biomecânicas definitivas e alegações de performance sem evidência.
- IA paga somente acionada explicitamente por operador autorizado, com credenciais server-side, limites, controle de custos, autenticação/autorização e auditoria; não expor API pública irrestrita.
- Sem migração adicional, importação, deploy ou ativação de API paga sem autorização específica.

## Integração técnica
1. Inspecionar rotas e telas reais do checkout atual, identificar endpoint operacional de busca e detalhes; validar forma de `CatalogProduct` e IDs sem adivinhar.
2. Criar componente de ficha inteligente (aba identidade, aba evidências) ligado ao clique no produto, preservando o fluxo atual de ofertas e links.
3. Criar API read-only de identidade/evidências para Master ID existente; validar IDs e limitar dados sensíveis; usar cache se disponível e identidade calculada a partir dos campos existentes.
4. Criar consultor de busca interno que usa os filtros e ordenação do catálogo real. Explicar critérios e permitir refinamento; nunca retornar produto que não veio da consulta comercial elegível.
5. Integrar busca superior com entrada conversacional opcional, sem substituir a busca tradicional; manter acessibilidade e responsividade.
6. Testes: API de identidade, isolamento de catálogo DEMO, recomendações reais, ausência de resultados, marca/modalidade/orçamento, preços/ofertas, ausência de chamada externa, proteção de rota de enriquecimento.
7. Testes no preview da porta 5000, evidência de navegação e relatório. Não afirmar integração concluída sem HTTP e teste real.

## Estado do ambiente em 2026-11-12
Banco `uppulse_catalog` homologado: 32.707 produtos, 96.851 ofertas, 16.945 projeções. Missão 10.6: migração aplicada, teste transacional SQL aprovado; testes automatizados de integração PostgreSQL efêmero reportados aprovados. Chamadas pagas desativadas. Checkout Codespaces local divergente (HEAD `322ed89`, alterações não commitadas); não usar pull/rebase/reset/stash/force-push, nem sobrescrever mudanças locais. GitHub remoto contém versão mais recente. Preview UpPulse foi aberto pelo operador após reiniciar o banco e a aplicação. 
