# F3c: Parcelas

> Status: aprovado em 2026-10-16. Calculadas na hora, sem tabela nova.

## Objetivo

Mostrar os parcelamentos em andamento, o que ainda falta pagar e quanto isso pesa mês a mês, e avisar quando o compromisso fica alto ou quando um parcelamento está terminando.

## Detecção e projeção (`packages/domain/src/installments`)

`detectInstallmentPlans(expenses, today): InstallmentPlan[]`, função pura. Entrada: saídas dos últimos 26 meses, sem movimentação, com a marca `{ current, total }` extraída de `normalize` (só as que têm marca).

- **Entra:** `1 ≤ atual ≤ total ≤ 24` (a marca inválida já vem nula do `normalize`). Uma marca no fim da descrição sem "PARC"/"PARCELA"/"n DE N" pode ser só uma data (`05/10`): é descartada quando coincide com o dia e o mês do lançamento, e só vale com 2 ou mais parcelas vistas.
- **Linha repetida:** a mesma parcela, de valor parecido, com até 5 dias de diferença é um lançamento em dobro e não abre plano novo.
- **Plano:** grupo por chave (`groupKey`), conta e `total`. Dentro do grupo, as parcelas se separam em planos por valor: uma parcela entra no plano cujo valor mediano está a até 15% do dela e que ainda não tem aquela parcela; senão abre um plano novo.
- **Valor da parcela:** mediana dos valores das parcelas vistas.
- **Última vista:** a de maior número (data e número).
- **Dia do mês:** mediana dos dias das parcelas vistas (a única, se só houver uma), limitado ao último dia de meses curtos.
- **Parcelas restantes:** `total − maior número visto`. O cronograma tem uma parcela por mês a partir do mês seguinte à última vista, no dia do mês; se a primeira data projetada já passou (parcela não lançada), o cronograma começa no primeiro mês cuja data é hoje ou depois.
- **Fim:** data da última parcela do cronograma (ou a última vista, se concluído). **Restante em reais:** `restantes × valor da parcela`.
- **Estado:**
  - `done`: a parcela `total` foi vista;
  - `stale`: faltam parcelas e hoje passou mais de 62 dias da última vista;
  - `active`: o resto.
- **Ordem:** ativos primeiro, depois por valor da parcela decrescente e nome.

`InstallmentPlan`: `{ key, label, accountId, sampleDescription, total, lastSeen, seenCount, installmentCents, remaining, lastSeenDate, nextDate, endDate, remainingCents, status, schedule: { date, cents }[] }`, com `key = grupo:conta:total:data da menor parcela vista`.

`commitmentByMonth(plans, fromMonth, maxMonths = 24): { month, cents }[]` soma o cronograma dos planos `active` por mês de calendário, do mês `fromMonth` até o último mês com parcela (no máximo `maxMonths`); lista vazia sem planos ativos.

## Insights

O `InsightContext` ganha `installments: InstallmentPlan[]`.

- **`high_commitment`** (atenção): o compromisso do mês seguinte passa de 30% da renda mediana dos até 3 meses anteriores com entrada (exige 2 ou mais). Título "Parcelas pesam em {mês}"; corpo "As parcelas somam R$ X em {mês}, P% da sua renda mediana (R$ Y)." Impacto: X. Chave `high_commitment:{AAAA-MM}`. Ação "Ver parcelas".
- **`installment_ending`** (informativo): plano `active` cuja última parcela cai no mês seguinte. Título "Parcelamento termina: {Nome}"; corpo "Em {mês} termina a parcela de R$ X de {Nome}." Impacto: o valor da parcela. Chave `installment_ending:{key}:{AAAA-MM}`. Ação "Ver parcelas".

## API

- `GET /v1/installments` devolve `{ plans, totals: { remainingCents, nextMonthCents, count }, byMonth: [{ month, cents }] }`:
  - `plans` em string de centavos, ativos primeiro;
  - `totals.count` e `remainingCents` contam só os ativos; `nextMonthCents` é o compromisso do mês seguinte;
  - `byMonth` vai do mês atual até o último mês com parcela (no máximo 24).
- O carregamento das saídas é compartilhado com as recorrências (mesma consulta de 26 meses, sob RLS); as parcelas são as que as recorrências descartam.
- Sem tabela nova e sem migração.

## Tela `/painel/parcelas` ("Parcelas" na navegação, depois de Recorrências)

- Cabeçalho: "{n} parcelamentos ativos, R$ X a pagar, R$ Y no próximo mês".
- Lista: estabelecimento, "parcela 3 de 10", valor, "faltam 7, R$ 1.393,00" e "última em dez/2027", com "Ver lançamentos".
- "Mês a mês": barras SVG do compromisso de cada mês, com tabela oculta.
- "Encerradas" recolhida (concluídas e paradas).
- Vazio: "Nenhum parcelamento encontrado. Compras com PARC 03/10 no texto aparecem aqui."

## Demo

"MAGALU PARC 01/10, 02/10 e 03/10" de R$ 199,00 (em andamento) e "NOTEBOOK DELL PARC 07/10, 08/10 e 09/10" de R$ 349,00, com a última no dia de hoje (falta uma parcela, no mês seguinte).

## Testes

- **Unitários:** plano simples, uma parcela só, datas de fim de mês e de ano, valor mediano, `done`, `stale`, separação por valor e por total, rejeições, compromisso por mês, estabilidade, geradores.
- **Integração:** endpoint com um parcelamento, concluído, parado, sem parcelas, isolamento, os dois insights, e as recorrências continuam ignorando as parcelas.
- **E2E:** página com planos e "Mês a mês", encerradas, vazio, insight dispensável e axe.

## Fora de escopo

Cadastrar compra parcelada, detectar parcelas ainda não lançadas, juros e antecipação, fatura mensal do cartão e parcelas sem marca no texto.
