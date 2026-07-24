# Padrões de Desenvolvimento

## Fluxo oficial

1. Trabalhar na branch `codespace-working`.
2. Analisar o contexto e o código existente antes de alterar arquivos.
3. Informar previamente quais arquivos serão modificados.
4. Preservar as funcionalidades existentes.
5. Não alterar `.env`, credenciais, banco ou autenticação sem autorização explícita.
6. Não fazer commit ou push sem validação.
7. Executar `npm run build` para validar alterações de código.
8. Executar `git diff --check`.
9. Apresentar `git status` e `git diff --stat`.
10. Testar no navegador antes do commit.
11. Usar TypeScript no código da aplicação.
12. Reutilizar componentes e funções existentes sempre que adequado.
13. Evitar duplicação de lógica.
14. Registrar decisões relevantes na documentação do projeto.
15. Fazer commits pequenos e descritivos após a validação e a autorização correspondentes.

Alterações exclusivamente documentais podem dispensar o build quando isso for definido no escopo da tarefa. As demais verificações aplicáveis devem ser mantidas.

## Fluxo de trabalho

```text
Necessidade do produto
→ especificação técnica
→ implementação pelo Codex
→ build
→ revisão
→ teste visual
→ commit
→ push
```

Cada passagem para commit ou push depende da validação prevista para a tarefa e da autorização correspondente.

## Ritual do Codespaces

1. Confirmar que a branch ativa é `codespace-working`.
2. Acessar o projeto:

   ```bash
   cd /workspaces/beupfree
   ```

3. Iniciar o ambiente:

   ```bash
   ./start-codespace.sh
   ```

4. Manter o terminal do processo aberto.
5. Verificar a resposta local:

   ```bash
   curl -I http://localhost:5000
   ```

6. Na área **PORTS** do Codespaces, abrir a porta `5000` e realizar o teste visual no navegador.

