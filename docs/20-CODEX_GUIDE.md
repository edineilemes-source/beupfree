# Guia Operacional do Codex

Este documento define a atuação permanente do Codex no projeto BeUpFree/UpPulse. Suas orientações devem ser observadas em toda missão realizada no repositório.

## 1. Papel do Codex

O Codex atua como desenvolvedor do projeto. Seu papel é:

- compreender a arquitetura existente antes de intervir;
- implementar as funcionalidades solicitadas;
- preservar as regras de negócio;
- preservar a Filosofia do Produto;
- evitar regressões;
- produzir código limpo, legível e consistente.

O Codex não deve decidir sozinho mudanças de arquitetura ou de negócio. Quando uma missão depender de uma decisão ainda não aprovada, o ponto deve ser identificado como pendência e submetido à validação responsável antes da implementação.

## 2. Documentação obrigatória

Antes de iniciar qualquer missão, o Codex deve consultar, nesta ordem:

1. `00-VISAO_DO_PRODUTO.md`;
2. `02-BACKLOG.md`;
3. `05-FILOSOFIA_DO_PRODUTO.md`;
4. `11-REGRAS_DE_NEGOCIO.md`;
5. `20-CODEX_GUIDE.md`.

Os documentos estão localizados na pasta `docs`. A consulta deve ocorrer antes da análise e de qualquer alteração no repositório.

## 3. Fluxo oficial

Toda missão segue esta ordem:

```text
Objetivo
↓
Análise
↓
Arquivos envolvidos
↓
Estratégia
↓
Implementação
↓
Validação técnica
↓
Teste funcional
↓
Revisão
↓
Commit
↓
Push
```

Commit e push são etapas formais posteriores à revisão e não devem ser executadas pelo Codex.

## 4. O que sempre fazer

- analisar a arquitetura;
- identificar o impacto da alteração;
- reutilizar componentes existentes;
- reutilizar funções existentes;
- evitar duplicação;
- preservar o padrão do projeto;
- usar TypeScript nas alterações de código;
- manter o código legível;
- preservar as regras de negócio;
- preservar a Filosofia do Produto.

## 5. O que nunca fazer

O Codex nunca deve:

- alterar `.env`;
- alterar credenciais;
- alterar o banco;
- alterar autenticação;
- alterar deploy;
- remover funcionalidades;
- inventar regras de negócio;
- criar funcionalidades não solicitadas;
- fazer commit;
- fazer push;
- fazer reset.

Os itens acima são protegidos e permanecem fora do escopo de atuação do Codex.

## 6. Implementação

### Antes de alterar

- informar os arquivos envolvidos;
- explicar a estratégia de implementação;
- confirmar que a intervenção está dentro do objetivo solicitado.

### Depois de alterar

- resumir as alterações realizadas;
- listar todos os arquivos modificados;
- informar limitações ou pendências identificadas.

## 7. Validação

Ao final de toda missão, executar:

```bash
git diff --check
git status
git diff --stat
```

O build deve ser executado somente quando houver alteração de código. Quando apenas arquivos de documentação forem modificados, o build não deve ser executado.

O teste funcional deve ser proporcional ao tipo e ao impacto da mudança. Quando não for aplicável, essa condição deve ser informada na entrega.

## 8. Critérios de qualidade

Todo código deve:

- ser simples;
- ser reutilizável;
- ser consistente;
- evitar duplicação;
- preservar a arquitetura;
- manter boa legibilidade.

Uma solução tecnicamente válida não deve ser aceita se contrariar regras de negócio, princípios do produto ou padrões consolidados do projeto.

## 9. Critérios de entrega

Toda missão termina apresentando:

1. resumo;
2. arquivos alterados;
3. pendências;
4. resultado de `git status`;
5. resultado de `git diff --stat`.

Falhas de validação, testes não executados e decisões ainda necessárias devem ser declarados de forma objetiva.

## 10. Princípio final

Toda implementação deve respeitar, nesta ordem de responsabilidade:

- a Filosofia do Produto;
- as Regras de Negócio;
- a arquitetura;
- a experiência do usuário.

Esses fundamentos devem ser preservados antes de considerar otimizações de desempenho ou a adoção de novas tecnologias.
