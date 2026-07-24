# Modelo de Interesse do Usuário

## 1. Objetivo

Este documento define como o BeUpFree representa o interesse de um usuário por um produto ao longo do tempo.

O objetivo é estabelecer um modelo evolutivo capaz de acompanhar a jornada de decisão do usuário e sustentar, progressivamente, os seguintes recursos:

- Favoritos;
- Minha Lista;
- Histórico;
- Alertas;
- IA;
- Recomendações.

Este é um conceito de domínio. Ele não define API nem implementação e não estabelece decisões técnicas.

## 2. Conceito

### Estado de Interesse do Usuário

O **Estado de Interesse do Usuário** representa a relação entre um usuário e um produto em determinado momento de sua jornada.

O produto permanece o mesmo durante essa relação. O que evolui é o interesse do usuário, manifestado por suas escolhas, ações e interações ao longo do tempo.

Esse conceito permite interpretar a jornada sem atribuir ao produto características que pertencem ao comportamento do usuário.

## 3. Estados

### NORMAL

- **Significado:** representa a relação inicial ou neutra entre o usuário e o produto.
- **Objetivo:** indicar que não há uma manifestação específica de interesse registrada para o produto.
- **Observações:** pode ser o ponto de partida da jornada ou o resultado da remoção de uma manifestação anterior de interesse.
- **Status:** Planejado.

### FAVORITO

- **Significado:** representa um produto pelo qual o usuário demonstrou interesse e deseja reencontrar com facilidade.
- **Objetivo:** permitir que o usuário preserve uma referência de interesse para consulta posterior.
- **Observações:** não indica intenção definitiva de compra e permanece conceitualmente distinto de Minha Lista.
- **Status:** Planejado.

### MINHA_LISTA

- **Significado:** representa um produto selecionado pelo usuário para organização, análise ou comparação.
- **Objetivo:** apoiar uma etapa mais estruturada da jornada de decisão.
- **Observações:** não é carrinho, não reserva estoque e não inicia checkout.
- **Status:** Planejado.

### VISITOU_MARKETPLACE

- **Significado:** representa que o usuário abriu o ambiente do marketplace parceiro a partir do BeUpFree.
- **Objetivo:** registrar um avanço de interesse em direção à consulta da oferta no parceiro.
- **Observações:** a visita não comprova compra, pagamento ou conclusão de transação.
- **Status:** Planejado.

### ALERTA

- **Significado:** representa uma relação de interesse acompanhada por uma comunicação relevante sobre o produto ou sua oferta.
- **Objetivo:** permitir que o usuário seja informado sobre mudanças ou oportunidades relacionadas ao item de interesse.
- **Observações:** o recebimento de um alerta não implica ação posterior nem intenção definitiva de compra.
- **Status:** Planejado.

### COMPRADO

- **Significado:** representará a confirmação de que o produto foi comprado pelo usuário.
- **Objetivo:** permitir que a jornada de interesse reconheça uma decisão de compra concluída.
- **Observações:** estado futuro, condicionado a uma forma confiável de confirmação; uma visita ao parceiro não é suficiente para estabelecê-lo.
- **Status:** Planejado.

### ARQUIVADO

- **Significado:** representará uma relação de interesse retirada da jornada ativa, mas preservada para referência futura.
- **Objetivo:** permitir que o usuário organize interesses que não exigem acompanhamento imediato.
- **Observações:** arquivar não significa excluir o produto nem apagar necessariamente o histórico da relação.
- **Status:** Planejado.

## 4. Eventos

Eventos representam ações ou ocorrências que modificam o Estado de Interesse do Usuário. Entre os eventos previstos estão:

- **Favoritar:** altera a relação para FAVORITO.
- **Desfavoritar:** remove a condição de FAVORITO e conduz a relação ao estado aplicável após essa ação.
- **Adicionar à Minha Lista:** altera a relação para MINHA_LISTA.
- **Remover da Minha Lista:** remove a condição de MINHA_LISTA e conduz a relação ao estado aplicável após essa ação.
- **Abrir Marketplace:** altera a relação para VISITOU_MARKETPLACE.
- **Receber Alerta:** altera a relação para ALERTA ou registra esse avanço no acompanhamento do interesse.
- **Comprar (futuro):** alterará a relação para COMPRADO quando houver confirmação confiável.
- **Arquivar (futuro):** alterará a relação para ARQUIVADO.

Um evento expressa uma mudança na relação entre usuário e produto. A interpretação do estado resultante deve considerar a jornada já percorrida e as capacidades disponíveis em cada fase do BeUpFree.

## 5. Transições

Um fluxo possível de evolução do interesse é:

```text
NORMAL
↓
Favoritar
↓
FAVORITO
↓
Adicionar à Minha Lista
↓
MINHA_LISTA
↓
Abrir Marketplace
↓
VISITOU_MARKETPLACE
↓
Comprar (futuro)
↓
COMPRADO
```

Nem todas as transições são obrigatórias. O usuário pode avançar, retornar, remover um interesse ou iniciar sua jornada por caminhos diferentes, conforme o contexto e os recursos disponíveis.

## 6. Princípios

- O produto não muda.
- O estado muda.
- Favoritos não representa intenção definitiva de compra.
- Minha Lista representa análise.
- Visita ao marketplace não representa compra.
- A compra não poderá ser confirmada automaticamente sem uma integração futura que forneça evidência confiável.

## 7. Decisões aprovadas

- Favoritos e Minha Lista são conceitos diferentes.
- Minha Lista não é carrinho.
- O checkout ocorre no parceiro.
- A persistência inicial utilizará `localStorage`.
- A sincronização em nuvem permanece em avaliação.

## 8. Decisões em avaliação

- Múltiplas listas.
- Compartilhamento.
- Notas pessoais.
- Etiquetas.
- Histórico completo.
- Sincronização entre dispositivos.
- Confirmação automática de compra.
- Mudança de nomenclatura de “Favoritos”.

## 9. Evolução do modelo

A evolução prevista está organizada em três fases:

### Fase 1

```text
Favoritos
↓
Minha Lista
```

### Fase 2

```text
Alertas
↓
Histórico
↓
IA
```

### Fase 3

```text
Perfil Inteligente
↓
Recomendações
↓
Ecossistema de Compra
```

Essa evolução representa apenas uma direção estratégica. A sequência, o escopo e a disponibilidade de cada capacidade poderão ser ajustados conforme o aprendizado do produto e as decisões futuras do BeUpFree.

## 10. Conclusão

“O valor do BeUpFree não está apenas nos produtos apresentados, mas na capacidade de compreender e acompanhar o interesse do usuário ao longo de toda sua jornada de decisão.”
