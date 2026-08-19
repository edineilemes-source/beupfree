# beupfree
lojas de produtos esportivos

## Desenvolvimento no GitHub Codespaces

O PostgreSQL oficial é externo e acessado somente por `DATABASE_URL`. O
deployment recomendado usa o Supabase Session Pooler; PostgreSQL local não é
requisito. Na branch `codespace-working`, o ritual oficial é:

```bash
cd /workspaces/beupfree
./start-codespace.sh
```

O script resolve o diretório do projeto, valida branch, `.env` e o formato de
`DATABASE_URL`, executa um teste real no PostgreSQL remoto, verifica conflitos
na porta 5000, sobe o UpPulse e só informa que o ambiente está pronto depois de
confirmar `LISTEN` em `0.0.0.0:5000` com `ss` e HTTP 200. Uma segunda execução
não cria outra instância. O script nunca encerra um processo que não iniciou.
Mantenha o terminal aberto; `Ctrl+C` encerra somente a instância iniciada por
ele e libera a porta.

Depois da mensagem de sucesso, abra **PORTS → 5000 → Open in Browser**. Essa
validação cobre o serviço local; o túnel de Preview do Codespaces é uma camada
separada.

Para diagnóstico manual:

```bash
ss -ltnp | grep ':5000'
curl -I http://localhost:5000
```

O comando curto `uppulse` pode ser avaliado futuramente. Esta configuração não
altera o shell do usuário nem instala comandos globais.

## Arquitetura de produção preparada

```text
GitHub main → Hostinger Node.js → DATABASE_URL → Supabase PostgreSQL
```

Esta etapa apenas documenta a arquitetura; não realiza deploy. Configure no
ambiente da Hostinger, sem gravar valores reais no repositório:

```text
NODE_ENV=production
PUBLIC_DEMO_MODE=true
DATABASE_URL=<configurada no ambiente>
SESSION_SECRET=<configurada no ambiente>
PUBLIC_CONTACT_EMAIL=<configurada no ambiente>
```

O Supabase é usado exclusivamente como PostgreSQL gerenciado. Autenticação,
sessões, storage, APIs, repositories, Drizzle e lógica de negócio permanecem na
arquitetura atual da aplicação.
