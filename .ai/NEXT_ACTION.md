# Próxima ação — atualizada em 2026-11-10 (Missão 10.1)

```yaml
originating_mission: MISSAO10.1-GOVERNANCA
recommended_next_mission: "Validar backup do uppulse_catalog, compatibilidade da migração de cache, e homologar adaptador PostgreSQL após autorização explícita."
reason: "Banco consolidado confirmado com 32707 products, 96851 offers, 16945 catalog_search_products; migração mission10_product_intelligence_cache.sql ainda não aplicada."
requires_user_decision: true
requires_chatgpt_review: true
```

- Fonte canônica: [docs/ESTADO_OPERACIONAL.md](../docs/ESTADO_OPERACIONAL.md).
- Não utilizar o antigo banco da Missão 8, não executar `db:push`, não acionar Tavily/OpenAI em lote.
- Relatórios futuros devem ser salvos em `docs/relatorios/` no GitHub; não exigir cópia manual de logs.
- O conteúdo abaixo foi substituído e fica apenas como referência histórica:

<details><summary>Próxima ação histórica — UPCAT003</summary>

# Próxima ação

```yaml
originating_mission: UPCAT003
recommended_next_mission: "Reexecutar a homologação real do catálogo operacional em Codespaces com DNS/rede disponíveis, cobrindo lista sanitizada, detalhe, redirect afiliado sem seguir até compra e rollback HTTP para demo; não ativar produção."
reason: "Os defeitos de detalhe, clique e encaminhamento de filtros foram corrigidos e validados com fixtures, mas EAI_AGAIN impediu qualquer evidência contra catalog_search_products real."
requires_user_decision: true
requires_chatgpt_review: true
```


</details>
