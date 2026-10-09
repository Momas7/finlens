# F5a: Insights

> Status: aprovado em 2026-10-09. Metas ficam para a F5b. Os geradores que dependem das recorrências e das parcelas da F3 ficam fora.

## Objetivo

Apontar o que saiu do normal no mês, com números e uma ação, sem a pessoa precisar procurar.

Critérios de sucesso:

- Lançar "NETFLIX R$ 55,90" duas vezes em dias seguidos faz aparecer, na Início, "Possível cobrança duplicada" com "Ver lançamentos" e "Dispensar".
- `/painel/insights` lista todos os insights, ordenados por impacto.
- Um insight dispensado não volta.

## Arquitetura

- **Domínio puro** em `packages/domain/src/insights/`. Cada gerador é `(ctx: InsightContext) => InsightCandidate[]`, e `rankInsights` filtra e ordena.
- **API** em `apps/api/src/modules/insights/`. Monta o `InsightContext` com consultas sob RLS, roda os geradores e cruza o resultado com `insight_states`.
- **Cálculo na hora**, a cada requisição. Não há job.

### `InsightContext`

```
{
  month: Month, today: 'YYYY-MM-DD', day: number,
  expenses: [{                       // saídas (valor < 0, sem movimentação) do mês corrente e dos 6 anteriores
    id, postedDate, amountCents: bigint (absoluto), accountId, description,
    groupKey: string | null,         // 'm:<merchant>' ou 'd:<normalizado>'; null se a descrição normalizada for vazia
    groupLabel: string,              // nome do estabelecimento ou descrição normalizada
    rootId: string | null, rootLabel: string | null, categoryKey: string | null  // system_key da categoria do lançamento
  }],
  monthTotals: [{ month, incomeCents, expenseCents }],   // mês corrente e os 4 anteriores
  activeMonths: Month[],                                 // dos 6 meses fechados, os que têm qualquer lançamento
  budgets: [{ categoryId, label, limitCents, spentCents, state, overOnDay, projectedCents }]  // mês corrente, só com limite
}
```

### `InsightCandidate`

`{ kind, severity: 'info' | 'warning', dedupeKey, title, body, impactCents: bigint, action: { label, href } | null }`

## Geradores

Todos olham o mês corrente. Os valores aparecem formatados em reais (`formatBRL`).

### 1. Categoria acima do normal (`category_spike`)

- **Gasto atual:** saídas da categoria principal com dia do mês até `day`.
- **Referência:** mediana do mesmo recorte (dia do mês até `min(day, último dia daquele mês)`) nos meses de `activeMonths`. Exige 3 meses ou mais.
- **Dispara quando:** `atual ≥ mediana × 1,3` e `atual − mediana ≥ R$ 100`.
- **Severidade:** `warning`. Impacto: `atual − mediana`.
- **Texto:**
  - título "{Categoria} acima do normal";
  - corpo "R$ X até o dia D, R$ Y acima do normal para esta altura do mês.".
- **Ação:** "Ver lançamentos", que abre a lista filtrada pela categoria e pelo mês.
- **Chave:** `category_spike:{mês}:{rootId}`.

### 2. Pequenas compras (`small_purchases`)

- **Considera:** saídas do mês abaixo de R$ 30 (estritamente).
- **Dispara quando:** há 10 ou mais dessas saídas e a soma chega a R$ 150.
- **Severidade:** `info`. Impacto: a soma.
- **Texto:**
  - título "Pequenas compras somam";
  - corpo "{n} compras abaixo de R$ 30 somam R$ X este mês.".
- **Ação:** "Ver lançamentos", que abre a lista do mês.
- **Chave:** `small_purchases:{mês}`.

### 3. Lançamento fora do padrão (`anomaly`)

- **Considera:** cada saída do mês com `groupKey`.
- **Histórico:** as saídas do mesmo grupo nos 6 meses anteriores ao mês corrente. Exige 5 ou mais.
- **Cálculo:**
  - `med` = mediana do histórico; `mad` = mediana de `|x − med|`;
  - com `mad > 0`, dispara se `(x − med) / (1,4826 × mad) ≥ 3,5`;
  - com `mad = 0`, dispara se `x ≥ 2 × med`;
  - nos dois casos, também exige `x − med ≥ R$ 50`.
- **Severidade:** `warning`. Impacto: `x − med`.
- **Texto:**
  - título "Valor fora do padrão";
  - corpo "{grupo}: R$ X em {dd/mm}, normalmente R$ {med}.".
- **Ação:** "Ver lançamentos", que busca a descrição no mês.
- **Chave:** `anomaly:{id}`.

### 4. Tarifas, juros e IOF (`fees`)

- **Considera:** saídas do mês com `categoryKey` em `financial.fees`, `financial.interest` ou `financial.iof`.
- **Dispara quando:** a soma é maior que zero.
- **Severidade:** `warning` se houver juros; senão, `info`. Impacto: a soma.
- **Texto:**
  - título "Tarifas, juros e IOF";
  - corpo "Você pagou R$ X em tarifas, juros e IOF este mês.".
- **Ação:** "Ver lançamentos", que abre a lista filtrada pela categoria Financeiro e pelo mês.
- **Chave:** `fees:{mês}`.

### 5. Possível cobrança duplicada (`duplicate`)

- **Considera:** saídas do mês.
- **Agrupa:** mesma conta, mesmo valor e mesmo `groupKey` não nulo. Dentro de cada grupo, ordena por data.
- **Dispara:** para cada par consecutivo com até 2 dias de diferença.
- **Severidade:** `warning`. Impacto: o valor.
- **Texto:**
  - título "Possível cobrança duplicada";
  - corpo "{grupo} R$ X apareceu em {dd/mm} e {dd/mm}.".
- **Ação:** "Ver lançamentos", que busca a descrição no mês.
- **Chave:** `duplicate:{idA}:{idB}`, com os ids em ordem.

### 6. Ritmo de orçamento (`budget_pace`)

- **Quando o estado é `over` e o gasto passa do limite:**
  - título "{Categoria} passou do orçamento";
  - corpo "R$ X acima do limite de R$ L.";
  - impacto: `gasto − limite`.
- **Quando `overOnDay` não é nulo:**
  - título "{Categoria} deve passar do orçamento";
  - corpo "No ritmo atual, passa do limite por volta do dia N e fecha em R$ P.";
  - impacto: `projeção − limite`.
- **Severidade:** `warning`.
- **Ação:** "Ver orçamento", que abre `/painel/orcamentos`.
- **Chave:** `budget_pace:{mês}:{categoryId}`.

### 7. Taxa de poupança (`savings`)

- **Mês analisado:** o último mês fechado (`m = previousMonth(month)`). Sem entradas, não dispara.
- **Se saiu mais do que entrou:**
  - título "Faltou dinheiro em {mês}";
  - corpo "Em {mês} saiu R$ X a mais do que entrou.";
  - severidade `warning`; impacto: o valor que faltou.
- **Senão:**
  - `taxa = sobra / entrada`;
  - referência: a mediana das taxas dos 3 meses anteriores a `m` que tiveram entrada. Exige 3 meses;
  - dispara se `referência − taxa ≥ 0,10`:
    - título "Sobrou menos em {mês}";
    - corpo "Sobrou {t}% da renda em {mês}, abaixo dos {r}% de costume.";
    - severidade `info`; impacto: `(referência − taxa) × entrada`.
- **Ação:** "Ver mês", que abre `/painel?mes={m}`.
- **Chave:** `savings:{m}`.

## Ranking (`rankInsights`)

- **Entrada:** os candidatos e os estados de cada chave.
- **Descarta:** os dispensados e os com impacto abaixo de R$ 20.
- **`isNew`:** `first_seen_at` ausente ou há menos de 3 dias.
- **Pontuação:** `impacto × (warning ? 1,5 : 1) × (isNew ? 1,3 : 1)`.
- **Ordem:** pontuação decrescente; empate por `dedupeKey`.
- **Limite:** `limit` itens.

## Dados

Tabela `insight_states`:

- **Colunas:**
  - `id uuid` (chave primária);
  - `workspace_id`;
  - `dedupe_key text not null`;
  - `first_seen_at timestamptz not null default now()`;
  - `dismissed_at timestamptz`.
- **Restrições:** unicidade em `(workspace_id, dedupe_key)`; RLS com ENABLE e FORCE em migração própria.
- **Ao servir:** grava `first_seen_at` dos insights mostrados com `insert … on conflict do nothing`.
- **Ao dispensar:** upsert que define `dismissed_at`.

## API

- `GET /v1/insights?limit=` devolve `{ items: Insight[] }`.
  - `limit` vai de 1 a 20 (padrão 20); fora disso, 400.
  - `Insight` é `{ id, kind, severity, title, body, impactCents, isNew, action }`.
  - O `id` são os primeiros 16 caracteres hexadecimais de `sha1(dedupeKey)`.
- `POST /v1/insights/dismiss { id }` devolve 204.
  - A API acha a chave entre os candidatos atuais.
  - Se o id não estiver entre eles, também devolve 204, sem efeito.
  - Formato inválido devolve 400.

## Telas

- **Início, só no mês corrente:**
  - bloco "O que mudou" entre o destaque e as colunas, com até 3 cartões;
  - cada cartão tem uma marca de severidade (fita na cor `mark` para atenção, `ink-soft` para informativo), título, corpo, ação, "Dispensar" e o selo "novo";
  - link "Ver todos ({n})" quando houver mais de 3;
  - se a API falhar, o bloco não aparece.
- **`/painel/insights`:**
  - título "O que mudou" e lista completa;
  - vazio: "Nada fora do comum por enquanto. Os insights aparecem conforme você lança.";
  - erro: "Não foi possível carregar os insights agora.";
  - item "Insights" na navegação, entre Orçamentos e Revisão.
- **Dispensar:** Server Action com `revalidatePath('/painel', 'layout')`. O botão tem nome acessível "Dispensar: {título}".

## Testes

- **Unitários:** casos de borda de cada gerador, `rankInsights` e formatação.
- **Integração (API):**
  - cenário com histórico lançado em datas passadas para cada gerador;
  - `isNew` e `first_seen_at` gravado uma única vez;
  - dispensar, inclusive em dobro;
  - isolamento entre usuários;
  - 400 para id ou `limit` inválidos.
- **Integração (DB):** RLS de `insight_states`.
- **E2E:**
  - duplicata na Início e dispensar;
  - a página e o estado vazio;
  - a ação abre a lista filtrada;
  - axe nos temas claro e escuro.

## Fora de escopo

Recorrentes, assinaturas, aumento de preço, parcelas (F3), peso no gasto variável, concentração temporal, LLM, notificações e metas (F5b).
