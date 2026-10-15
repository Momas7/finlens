# F3b: Recorrências

> Status: aprovado em 2026-10-15. Calculadas na hora, sem tabela nova. Parcelas ficam para a F3c.

## Objetivo

Mostrar o que se repete (assinaturas, aluguel, internet, academia, seguros), quanto custa por mês, e avisar de três situações: cobrança que não veio, aumento de preço e assinatura nova.

## Detecção (`packages/domain/src/recurrences`)

`detectRecurrences(expenses, today): Recurrence[]`, função pura. Entrada: saídas dos últimos 13 meses, sem movimentação (`id`, `postedDate`, `amountCents` absoluto, `accountId`, `groupKey`, `groupLabel`).

- **Grupo:** pela `groupKey` (estabelecimento ou descrição normalizada); sem chave, ignora. Ocorrências no mesmo dia contam como uma (a primeira).
- **Entra** com 3 ou mais ocorrências.
- **Cadência:** a mediana dos intervalos (dias) entre ocorrências consecutivas deve estar na tolerância de uma cadência: semanal 7 ± 2, mensal 30 ± 5, trimestral 91 ± 8, anual 365 ± 15. Pelo menos 70% dos intervalos precisam estar na tolerância da cadência.
- **Valor parecido:** pelo menos 70% das ocorrências dentro de ±15% da mediana dos valores.
- **Valor típico:** mediana das últimas 3 ocorrências (todas, se houver menos).
- **Custo mensal equivalente:** semanal × 52 / 12 (arredondado), mensal, trimestral ÷ 3, anual ÷ 12.
- **Próxima data esperada:** última ocorrência + intervalo mediano.
- **Estado:**
  - `ended`: hoje passou da última ocorrência + 2 × o intervalo mediano;
  - `late`: não está `ended`, a cadência é semanal ou mensal e hoje passou da próxima data esperada + tolerância;
  - `active`: o resto.
- **Aumento de preço (`priceChange { fromCents, toCents }`):**
  - a sequência final de valores a até 2% do último valor forma o "patamar novo" (inclui o último);
  - `fromCents` é a mediana dos valores anteriores a esse patamar (exige 2 ou mais);
  - vale se `toCents ≥ fromCents × 1,05`, a diferença é de pelo menos R$ 2 e a primeira ocorrência do patamar novo é de no máximo 2 intervalos atrás.
- **Nova:** primeira ocorrência há no máximo 60 dias e 3 ou mais ocorrências.
- Ordem de saída: custo mensal decrescente, depois nome.

`Recurrence`: `{ key, label, cadence, typicalCents, monthlyCents, firstDate, lastDate, nextExpectedDate, occurrences, intervalDays, status, priceChange, isNew, accountId }`.

## Insights (novos geradores em `packages/domain/src/insights`)

O `InsightContext` ganha `recurrences: Recurrence[]`.

- **`recurrence_missing`** (atenção): recorrência `late`. Título "{Nome} não apareceu"; corpo "{Nome} costuma cobrar R$ X por volta do dia D; não apareceu este mês." (D é o dia da próxima data esperada). Impacto: o valor típico. Chave `recurrence_missing:{grupo}:{AAAA-MM da data esperada}`.
- **`price_increase`** (atenção): recorrência com `priceChange`. Corpo "{Nome} subiu de R$ A para R$ B (+R$ C por ano).", com C = (B − A) × 12 para mensais, × 52 para semanais, × 4 para trimestrais e × 1 para anuais. Impacto: C. Chave `price_increase:{grupo}:{valor novo}`.
- **`new_subscription`** (informativo): recorrência `isNew`, ativa. Corpo "Nova assinatura: {Nome}, R$ X por mês." (custo mensal equivalente). Impacto: custo mensal × 12. Chave `new_subscription:{grupo}`.
- Ação dos três: "Ver lançamentos", com a busca pelo nome no período.

## API

- `GET /v1/recurrences` devolve `{ items: Recurrence[], totals: { monthlyCents, count } }`; `totals` soma só as `active` e as `late`. Valores em string de centavos.
- Uma função compartilhada (`loadRecurrenceExpenses`) carrega as saídas dos últimos 13 meses sem movimentação, para o endpoint e o contexto dos insights.

## Tela `/painel/recorrencias` ("Recorrências" na navegação, depois de Metas)

- Cabeçalho: "{n} cobranças recorrentes, R$ X por mês".
- Lista por custo: nome, cadência, valor típico, "Próxima por volta de dd/mm", selos "atrasada", "subiu de R$ A para R$ B" e "nova", e "Ver lançamentos".
- Seção "Encerradas" recolhida.
- Vazio: "Nenhuma cobrança recorrente encontrada. Elas aparecem quando algo se repete 3 vezes ou mais."

## Demo

Spotify de R$ 21,90, com 3 cobranças a cada 28 dias terminando 3 dias atrás (assinatura nova). Netflix passa de R$ 55,90 para R$ 59,90 nas duas cobranças do mês corrente (aumento de preço; a duplicata plantada passa a ser de R$ 59,90).

## Testes

- **Unitários:** cadências, rejeições, tolerância de valor, estados, aumento de preço, nova, estabilidade; os três geradores nos limiares.
- **Integração:** endpoint com histórico de 6 meses, movimentação fora, isolamento, usuário sem dados; os três insights.
- **E2E:** a página (lista, total, selos, vazio, encerradas); insight de aumento na Início; axe nos dois temas.

## Fora de escopo

Criar ou editar recorrências, previsão de gastos futuros, calendário, parcelas, recorrências de receita e mudança de texto do estabelecimento.
