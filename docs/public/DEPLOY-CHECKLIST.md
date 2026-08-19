# Checklist de deploy — UpPulse demo pública

## Preparação

- [ ] Confirmar branch/revisão aprovada e worktree conhecido.
- [ ] Registrar a quantidade de produtos retornada por `/api/products`.
- [ ] Conferir diversidade real para busca e filtros (marca, preço, desconto, gênero, idade, tamanho, cor, esporte e uso).
- [ ] Inventariar hosts das imagens e obter autorização adequada.
- [ ] Fazer backup testado do banco e definir responsável e retenção.
- [ ] Definir procedimento de rollback da aplicação e do banco.

## Ambiente e build

Arquitetura prevista: `GitHub main → Hostinger Node.js → DATABASE_URL →
Supabase PostgreSQL`. O deploy continua sendo uma etapa futura.

- [ ] Configurar `NODE_ENV=production`.
- [ ] Configurar `PUBLIC_DEMO_MODE=true` no build e no processo servidor.
- [ ] Configurar `DATABASE_URL` sem registrar seu valor em logs ou repositório.
- [ ] Configurar `SESSION_SECRET` forte, exclusivo e persistente.
- [ ] Configurar `PUBLIC_CONTACT_EMAIL` institucional.
- [ ] Usar o Session Pooler do PostgreSQL gerenciado e validar conectividade sem expor a URL.
- [ ] Inserir `AWIN_VERIFICATION_TOKEN` somente se a Awin fornecer e confirmar o mecanismo.
- [ ] Executar migrations aprovadas; WEB-PUBLIC001 não criou migration.
- [ ] Executar `npm run build` no mesmo ambiente que servirá os artefatos.

## Segurança e operação

- [ ] Habilitar HTTPS e cookies seguros; validar proxy confiável da hospedagem.
- [ ] Confirmar `404` em `/admin/*`, `/api/admin/*`, `/api/ml/*`, `/api/init*`, `/api/ai/*` e `/api/click/*`.
- [ ] Confirmar ausência de inicialização do scheduler/collectors nos logs.
- [ ] Confirmar que API, robots e páginas não expõem segredos, tokens, credenciais ou stack traces.
- [ ] Garantir que admin e API não sejam indexáveis.
- [ ] Validar health check OPS001/QA001 sem expor configuração sensível.

## Conteúdo e experiência

- [ ] Validar Home, catálogo, Sobre, Como funciona, Privacidade, Termos e Contato.
- [ ] Confirmar selo “Produto demonstrativo” em todos os cards públicos.
- [ ] Confirmar aviso global de preços demonstrativos.
- [ ] Confirmar que CTAs abrem o dialog e não redirecionam para a origem legada.
- [ ] Revisar qualquer URL externa opcional e aceitar somente referência HTTPS autorizada.
- [ ] Confirmar disclosure afiliado no futuro/condicional, sem alegar parceria ativa.
- [ ] Validar title, description, canonical, Open Graph, robots e sitemap.
- [ ] Validar desktop, tablet, mobile, teclado, foco, labels e contraste.

## Testes e liberação

- [ ] `npm run test:unit`
- [ ] `npm run test:auth-integration`
- [ ] `npm run test:favorites-integration`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] `npm run test:regression`
- [ ] `npm run test:public-demo`
- [ ] `git diff --check`
- [ ] Fazer smoke test pós-publicação sem mutar o catálogo.
- [ ] Monitorar erros e disponibilidade; acionar rollback se autenticação, favoritos, bloqueios ou catálogo falharem.
