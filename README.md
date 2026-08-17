# beupfree
lojas de produtos esportivos

## Desenvolvimento no GitHub Codespaces

Na branch `codespace-working`, o comando oficial para preparar o ambiente é:

```bash
./start-codespace.sh
```

O script entra no diretório correto do projeto, valida a branch e o
`DATABASE_URL`, inicia e verifica o PostgreSQL, sobe o UpPulse e só informa que
o ambiente está pronto depois de confirmar a porta 5000 com `ss` e uma resposta
HTTP 200. Não é necessário executar essas verificações manualmente na operação
normal. Mantenha o terminal aberto; `Ctrl+C` encerra a instância iniciada pelo
script, sem desligar o PostgreSQL.

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
