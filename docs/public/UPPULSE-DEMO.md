# UpPulse — demo pública

## Objetivo e conceito

A publicação preparada pela missão WEB-PUBLIC001 é uma demonstração institucional do UpPulse. Ela apresenta busca, filtros, preços, descontos e favoritos sobre um snapshot estável do catálogo já persistido, sem iniciar coleta externa e sem representar os valores como condições comerciais atuais.

O Google Shopping é benchmark funcional, não provider. A direção de aquisição continua sendo feeds e APIs autorizados, com Awin Product Feed como primeira integração recomendada.

## Snapshot e produtos demonstrativos

A solução de menor risco escolhida foi reutilizar os registros existentes como snapshot. Não houve cópia de tabelas, alteração de schema, migration ou marcação destrutiva. Com `PUBLIC_DEMO_MODE=true`, o scheduler não inicia e o conjunto persistido deixa de sofrer atualização automática pelo processo da aplicação.

O total efetivamente publicado deve ser conferido no checklist de deploy contra `GET /api/products` e registrado na evidência da publicação. Busca, marca, preço, desconto, gênero, idade, tamanho, cor, esporte/modalidade, tipo de uso e avaliação continuam dependentes dos atributos reais disponíveis; nenhum atributo foi inventado.

### Proposta de redução pública — não implementada

O banco possui atualmente 508 produtos e permanece intacto. Para uma futura demo mais controlada, recomenda-se projetar publicamente cerca de 40 produtos por seleção determinística e configurável, preservando diversidade de marcas, faixas de preço, desconto e atributos realmente disponíveis. A limitação deve ocorrer somente na consulta pública em modo demo, sem excluir ou remarcar registros e sem afetar o ambiente normal. Esta redução não foi implementada nesta missão e depende de aprovação.

## Neutralização e disclosure

No modo demo, as respostas públicas removem URLs comerciais, origem, seller e timestamps de atualização das ofertas. A interface usa o rótulo genérico **Loja demonstrativa**, que evita sugerir contrato com uma loja específica, e o selo **Produto demonstrativo**.

O CTA abre um dialog em vez de redirecionar. Uma ação **Visitar loja** só aparece quando existir `referenceUrl` HTTPS segura e não pertencente ao domínio legado bloqueado. O campo é opcional na projeção pública e prepara fontes oficiais, merchants autorizados ou deeplinks de afiliado futuros; nenhuma URL foi inventada.

Preços e descontos permanecem para demonstrar descoberta e filtros, acompanhados do aviso de que são demonstrativos e podem não refletir condições atuais. Comparação e UpPulse Score continuam desativados até haver dados autorizados e suficientes.

## Segurança operacional

Em `PUBLIC_DEMO_MODE=true`, o servidor responde `404` para:

- `/api/admin` e `/api/admin/*`;
- `/api/ml` e `/api/ml/*`;
- `/api/init` e `/api/init/*`;
- `/api/ai` e `/api/ai/*`;
- `/api/click` e `/api/click/*`.

As rotas administrativas do cliente também deixam de ser registradas. Isso não cria autorização administrativa: apenas retira essa superfície da demo. Fora do modo demo, as ferramentas existentes continuam disponíveis para desenvolvimento. Antes de uma futura publicação administrativa será necessário implantar autorização por papel dedicada.

O scheduler e collectors automáticos não iniciam na demo. Collectors, `executeSource` e demais infraestrutura não foram removidos.

## Configuração

Definir a flag tanto no ambiente de build do cliente quanto no processo servidor:

```text
NODE_ENV=production
PUBLIC_DEMO_MODE=true
DATABASE_URL=<configurar no provedor>
SESSION_SECRET=<segredo forte e exclusivo>
PUBLIC_CONTACT_EMAIL=<caixa institucional>
AWIN_VERIFICATION_TOKEN=<somente quando fornecido pela Awin>
```

Não alterar `.env` versionado. `PUBLIC_CONTACT_EMAIL` é opcional; sem ele a página de contato registra claramente a pendência. `AWIN_VERIFICATION_TOKEN` injeta uma meta tag não visual no HTML durante o build e deve permanecer ausente até a rede fornecer o identificador e confirmar o formato requerido.

## Imagens e limitações

As imagens atuais podem continuar sendo carregadas de hosts de terceiros como referência temporária. A missão não copiou imagens para storage próprio nem validou licenças individuais. Antes da publicação, inventariar hosts, disponibilidade e autorização. O caminho definitivo é consumir imagens expressamente fornecidas pelos feeds/merchants autorizados.

Outras limitações:

- preços, descontos, frete, rating e disponibilidade são dados congelados;
- “Loja demonstrativa” não identifica o vendedor real;
- nenhuma compra é realizada pelo UpPulse;
- não há integração afiliada ativa nem promessa de comissão atual;
- política e termos devem ser revistos ao ativar analytics, novos cookies, providers ou monetização.

## Caminho para feeds autorizados

1. Aprovar o site institucional e seu compliance.
2. Solicitar acesso ao programa/provider, começando por Awin.
3. Mapear o feed para `NormalizedProduct` e `NormalizedOffer`.
4. Validar direitos de exibição, cache, imagens, preço, reviews e uso de IA por fonte.
5. Substituir o snapshot por ingestão autorizada sem acoplar a experiência a um marketplace.
6. Só reativar comparação e score quando cobertura, atualidade e explicabilidade forem adequadas.

## Preparação para Awin e deploy futuro

O site explica a descoberta, organização, análise, redirecionamento ao lojista, ausência de venda direta e natureza futura/condicional dos afiliados. Não afirma parceria com Awin ou qualquer marca. A verificação de domínio tem configuração removível e sem token fictício.

Não houve deploy, DNS, merge, cadastro em rede, commit ou push nesta missão. Use [DEPLOY-CHECKLIST.md](./DEPLOY-CHECKLIST.md) antes de uma publicação futura na Hostinger.
