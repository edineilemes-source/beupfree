# UpPulse — diagnóstico real do Produto Mestre entre quatro lojas

**Data:** 26/11/2026. **Branch de implementação:** `feat/uppulse-master-comparacao-4-lojas-20261126`. **Branch canônica de homologação:** `feat/uppulse-missao10-supercatalogo`.

## Objetivo
O usuário quer localizar pelo menos um mesmo tênis em duas ou mais lojas (Dafiti, FutFanatics, Olympikus e Clovis) e visualizar as duas lojas e os respectivos preços, sem falsificar equivalências.

## Diagnóstico do código anterior
- `scripts/awin-partner-master.ts` processava **apenas as identidades de uma loja por execução**. O script declara `crossStoreMatching: PENDING_REVIEW_NOT_ASSUMED`; não mescla novos Masters entre lojas.
- `server/productIdentity/reader.ts` filtrava exclusivamente ofertas com desconto positivo, removendo registros válidos de **preço regular 0%** (Clovis e Olympikus).
- `VITE_UPPULSE_INTELLIGENT_CARD_ENABLED` está desabilitado na V1 e `MASTER_IDENTITY_ENABLED` precisa estar habilitado para o endpoint antigo; a Ficha Inteligente foi congelada por decisão anterior. **Não reativar automaticamente.**
- Até realizar consulta no banco do Codespaces, não há evidência de quantos grupos de Master multi-loja estão realmente confirmados. O total de 20.604 produtos na projeção não prova identidade cruzada.

## Funcionalidade de auditoria
- Nova consulta administrativa `GET /api/admin/awin-feeds/master-across-stores?limit=8`, restrita ao mesmo perfil de autorização da Curadoria e executada em PostgreSQL `REPEATABLE READ READ ONLY`.
- Resultado 1: grupos **Master confirmados** com associação vigente e completa, preços e links reais por merchant, usando o leitor histórico `readMaster()`.
- Resultado 2: grupos com mesmo **GTIN** em lojas distintas. São candidatos para revisão, nunca atribuídos automaticamente ao Master.
- Resultado 3: candidatos encontrados pelo **matcher histórico original** em até 25 mil ofertas elegíveis do catálogo. Se houver `AUTO_MATCH` de modelo entre lojas, a interface mostra os dois preços, mas marca explicitamente `MATCHER_AUTO_MATCH_NOT_PERSISTED` e não confirma vínculos Master sem revisão.
- Distinção entre oferta promocional comprovada e preço regular 0%. Nenhum preço anterior falso é exibido.
- A interface **Curadoria → Feeds de parceiros** ganhou o botão **Verificar tênis em duas ou mais lojas**, com grupos reais listados quando existentes; sem alterar base, gerar link fictício ou afirmar equivalência sem prova.
- A Ficha Inteligente da vitrine continua desabilitada conforme decisão comercial vigente. O diagnóstico comparativo ocorre exclusivamente na Curadoria até homologação de vínculos Master.

## Arquivos
- `server/curationSources/masterAcrossStores.ts`: relatório com limites e três níveis de certeza.
- `server/curationSources/awinFeedUpload.ts`: rota autorizada em transação read-only.
- `client/src/pages/AwinFeedUpload.tsx`: UI comparativa.
- `server/productIdentity/reader.ts`: aceita 0% regular válido e identifica um Master único mesmo com múltiplos memberships.
- `client/src/components/MasterOffers.tsx`: renderização segura do preço regular, mas sem ativar a Ficha Inteligente.
- `server/curationSources/masterAcrossStores.test.ts`, `masterAcrossStoresRoute.test.ts`, `package.json`: regressões.
- `.github/workflows/uppulse-master-crossstore.yml`: TypeScript, suíte unitária, build.

## Pendências para homologação
1. Confirmar CI do SHA final.
2. Publicar o SHA validado em snapshot imutável da porta 5013, sem modificar checkout local nem PostgreSQL.
3. Abrir Curadoria e executar a consulta no banco de homologação. Registrar exemplos reais se encontrados, ou ausência de vínculos confirmados e candidatos detectados, sem inventar produtos.
4. Somente depois de revisar os candidatos e grupos existentes, planejar uma integração reconciliada entre parceiros, com backup/testes/migrações autorizadas. Não fundir produtos por texto/GTIN sem evidências suficientes.
5. Os produtos e preços da Clovis e Olympikus permanecem elegíveis com desconto 0%; manter isolamento de lojas e preservação dos dados.

**Status inicial:** código implementado. Testes GitHub e homologação real a confirmar.

## Registro final de publicação e validação
- Branch canônica \`feat/uppulse-missao10-supercatalogo\` atualizada por fast-forward não destrutivo ao snapshot \`70e39395ca37f4c4de3111816385ae5a03e7be86\`, sem alterar o checkout do Codespaces ou dados do PostgreSQL.
- GitHub Actions \`45904737891\` no SHA acima: **SUCCESS** para TypeScript, suíte unitária e build. Teste de navegador com banco real não foi executado nesta etapa.
- GitHub Issues \`#119\`: parada controlada do preview antigo somente da porta 5013. \`#120\`: **SUCCESS Preview OK HTTP 200; profile basic passed** no novo snapshot. Esse resultado valida o servidor HTTP local, não comprova o funcionamento do endereço público nem os pares reais do banco.
- A contagem e os nomes de tênis coincidentes continuam **PENDENTES** até a consulta administrativa \`Verificar tênis em duas ou mais lojas\` ser executada sobre o banco homologado. Não declarar que há um exemplo real sem resultado.
