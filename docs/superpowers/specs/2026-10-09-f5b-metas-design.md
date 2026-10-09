# F5b: Metas

> Status: aprovado em 2026-10-09. Ficam de fora: aportes manuais, CDI automático e metas na Início.

## Objetivo

Acompanhar quanto falta para uma meta de dinheiro guardado, quando ela será atingida no ritmo atual e quanto guardar por mês para chegar numa data.

Critérios de sucesso:

- Com uma meta "Viagem" de R$ 10.000 vinculada à conta "Reserva" (saldo de R$ 2.000) e data-alvo, a tela mostra "R$ 2.000,00 de R$ 10.000,00", "faltam R$ 8.000,00" e o aporte necessário.
- Lançar um depósito na Reserva faz a meta andar.

## Regras

- **Meta:** nome, valor-alvo, conta vinculada, data-alvo (opcional) e rendimento anual (opcional, em pontos-base).
- **Conta vinculada:** corrente, poupança ou dinheiro, nunca cartão. Cada conta tem no máximo uma meta ativa.
- **Progresso:** é o saldo atual da conta, o mesmo de `/v1/accounts`.
  - `progress = saldo / alvo`, limitado a 1 para exibição;
  - `falta = max(0, alvo − saldo)`.
- **Ritmo (`monthlyPace`):** média das variações do saldo de fim de mês entre os pontos disponíveis.
  - Os pontos são os fins dos 4 meses antes do mês corrente: `M−4`, `M−3`, `M−2` e `M−1`. Só contam os fins de mês iguais ou posteriores à data do saldo inicial.
  - Com menos de 2 pontos, o ritmo é `null`.
  - O saldo de fim de mês é o saldo inicial mais as transações com `posted_date` entre a data do saldo inicial e o fim do mês.
- **Taxa mensal:** `i = (1 + bp/10000)^(1/12) − 1`; sem taxa, `i = 0`.
- **Meses até o alvo (`monthsToTarget`):**
  - simula mês a mês: `b ← b × (1+i) + aporte` até `b ≥ alvo`;
  - devolve 0 se já atingiu;
  - devolve `null` se não atinge em 600 meses, ou se `aporte ≤ 0` e `i = 0`;
  - o ritmo `null` conta como aporte 0.
- **Mês previsto:** mês corrente + n.
- **Aporte necessário (`requiredMonthly`):** só existe com data-alvo.
  - `n = meses entre o mês corrente e o mês da data`; se `n < 1`, usa `n = 1`;
  - com data já passada, devolve `null`;
  - sem taxa: `ceil(falta / n)`;
  - com taxa: `ceil((alvo − saldo × (1+i)^n) × i / ((1+i)^n − 1))`;
  - resultado `≤ 0` vira 0, que significa "só o rendimento chega lá".
- **Status:**
  - `done`: saldo ≥ alvo;
  - `no_date`: sem data-alvo;
  - `no_pace`: com data, mas sem previsão;
  - `on_track`: mês previsto ≤ mês da data;
  - `behind`: mês previsto depois do mês da data, com `delayMonths` = a diferença em meses.

## Dados

Tabela `goals`:

- `id` e `workspace_id`;
- `account_id`, com FK composta `(workspace_id, account_id)`;
- `name text` (de 1 a 60 caracteres);
- `target_cents bigint`, com `check > 0`;
- `target_date date`, nulo quando não há data;
- `annual_rate_bp integer`, nulo quando não há taxa, com `check` entre 0 e 10000;
- `archived_at`, `created_at` e `updated_at`;
- índice único parcial em `(workspace_id, account_id)` com `where archived_at is null`;
- RLS com ENABLE e FORCE em migração própria.

## API

- **`GET /v1/goals`:** devolve as metas ativas. Com `?archived=true`, inclui as arquivadas.
- **`POST /v1/goals`:** corpo `{ name, targetCents, accountId, targetDate?, annualRatePercent? }`.
  - `annualRatePercent` é uma string decimal com até 2 casas, de 0 a 100, e vira pontos-base;
  - data-alvo anterior a hoje devolve 400.
- **`PATCH /v1/goals/:id`:** aceita `{ name?, targetCents?, targetDate?, annualRatePercent? }`; `null` limpa a data ou a taxa. A conta não muda.
- **`DELETE /v1/goals/:id`:** arquiva a meta e devolve 204.
- **Erros:**
  - conta ou meta inexistente, ou de outro workspace: 404;
  - conta de cartão: 409, "Escolha uma conta corrente, poupança ou dinheiro.";
  - conta com meta ativa: 409, "Esta conta já tem uma meta.";
  - validação: 400.
- **Cada `Goal` traz:**
  - `id`, `name`, `targetCents`, `targetDate`, `annualRatePercent` (string ou null);
  - `accountId`, `accountName`, `balanceCents`;
  - `progress`, `remainingCents`, `monthlyPaceCents`;
  - `projectedMonth`, `requiredMonthlyCents`, `status`, `delayMonths` e `archived`.

## Telas

`/painel/metas`, com o item "Metas" na navegação depois de Orçamentos.

- **Cartão de cada meta:**
  - nome e `Scale` de saldo contra alvo ("Progresso de {nome}");
  - "R$ X de R$ Y" e "faltam R$ Z";
  - previsão:
    - "No ritmo atual (R$ P por mês), chega lá em {mês de ano}.";
    - "No ritmo atual, não chega lá." (sem previsão);
    - "Ainda sem ritmo: precisa de um mês fechado nesta conta." (ritmo `null`);
  - com data-alvo:
    - "Para chegar em {mês de ano}, guarde R$ N por mês.";
    - "Só o rendimento já chega lá.";
    - "A data passou.";
  - com `behind`: "{d} meses depois do planejado."; com `on_track`: "No prazo.";
  - selo "Concluída" quando o status é `done`;
  - "Alterar" (formulário na linha, rótulos com o nome da meta) e "Arquivar" (com confirmação).
- **Formulário "Nova meta":**
  - campos Nome, Valor-alvo, Conta (só as elegíveis sem meta), Data-alvo (opcional) e "Rende ao ano (%)" (opcional);
  - botão "Criar meta".
- **Sem conta elegível:** "Cadastre uma conta poupança para acompanhar uma meta.", com link "Cadastrar conta".
- **Sem metas:** "Nenhuma meta ainda.".

## Testes

- **Unitários:** `monthlyRate`, `monthlyPace`, `monthsToTarget`, `requiredMonthly` e `goalStatus`, nos casos da seção de regras.
- **Integração (API):**
  - criar e listar, com o saldo igual ao de contas;
  - ritmo, previsão e aporte com lançamentos em meses passados;
  - PATCH, inclusive limpando a data;
  - arquivar e reutilizar a conta;
  - erros 409, 404 e 400;
  - isolamento entre usuários.
- **Integração (DB):** RLS de `goals` e o índice parcial.
- **E2E:**
  - criar uma meta e ver os números;
  - um depósito faz a meta andar;
  - alterar e arquivar;
  - mensagem sem conta elegível;
  - axe nos temas claro e escuro.

## Fora de escopo

Aportes manuais, várias contas por meta, CDI automático, metas na Início, insights de metas e investimentos com cotação.
