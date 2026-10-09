# F4b: Orçamentos

> Status: aprovado em 2026-10-09. Separar gasto fixo de variável depende das recorrências da F3 e fica fora desta fase.

## Objetivo

Definir um limite mensal por categoria principal de despesa e acompanhar quanto já foi gasto, em que ritmo e quando o limite estoura, com uma sugestão de valor tirada do próprio histórico.

Sucesso:

- Em `/painel/orcamentos` a pessoa define "Alimentação: R$ 750". A sugestão vem pré-preenchida quando há histórico suficiente.
- A régua mostra "R$ 612 de R$ 750", o estado ("82%, atenção") e, no mês corrente, o ritmo ("No ritmo atual, fecha em R$ 1.240").
- Mudar o limite em outubro não altera setembro.
- A Início mostra o traço do limite em "Para onde foi" e avisa quando algum orçamento está em atenção ou passou.

## Regras

- **Nível:** um orçamento por categoria principal de despesa (`parent_id` nulo, `kind = 'expense'`, ativa). O gasto soma as subcategorias.
- **Vigência:**
  - cada valor é gravado com o mês de início (`effective_from`, sempre o primeiro dia do mês);
  - o limite de um mês é o da versão mais recente com início até aquele mês;
  - definir, mudar ou remover sempre grava a partir do mês corrente, e gravar de novo no mesmo mês sobrescreve;
  - remover grava `amount_cents` nulo, que significa "sem orçamento a partir daqui";
  - meses passados não são editáveis.
- **Gasto:** o mesmo número de "Para onde foi" na F4a. São as saídas do mês, em valor absoluto, na categoria principal e nas subcategorias; movimentação não conta e estorno não reduz o gasto.
- **Estado** (`budgetState`): `ok` abaixo de 80%; `warning` de 80% até antes de 100%; `over` a partir de 100%.
- **Ritmo** (`pace`), só no mês corrente e a partir do dia 5:
  - `projectedCents = round(gasto / dia × diasDoMês)`;
  - `overOnDay`: se o gasto ainda está abaixo do limite e a projeção passa dele, é o dia em que o limite estoura nesse ritmo, `ceil(limite / (gasto / dia))`, limitado ao último dia do mês; senão, `null`;
  - `dailyAllowanceCents`: com gasto abaixo do limite, `floor((limite − gasto) / diasRestantes)`, em que `diasRestantes = diasDoMês − dia + 1`; senão, `null`;
  - antes do dia 5, ou sem limite, `pace` é `null`.
- **Sugestão** (`suggestBudget`):
  - considera os 6 meses fechados antes do mês corrente, mas só os meses em que o workspace lançou ao menos uma transação;
  - em cada um desses meses, toma o gasto da categoria (zero se não houve gasto);
  - com 3 meses ou mais, o valor é a mediana arredondada para cima ao múltiplo de R$ 50 (5.000 centavos), com mínimo de R$ 50;
  - se a mediana for zero (a categoria não costuma ter gasto), não há sugestão;
  - com menos de 3 meses, não há sugestão (`null`).
- **Alertas:** só visuais. Não há notificações.

## Dados

Tabela `budgets`:

- **Colunas:**
  - `id uuid` (pk), `workspace_id`, `category_id uuid not null`;
  - `effective_from date not null`, com check `extract(day from effective_from) = 1`;
  - `amount_cents bigint` (nulo = sem orçamento; check `amount_cents is null or amount_cents > 0`);
  - `created_at` e `updated_at`.
- **Restrições:**
  - unicidade em `(workspace_id, category_id, effective_from)`;
  - FK composta `(workspace_id, category_id)` para `categories`;
  - RLS com ENABLE e FORCE e a política padrão do ADR 0002, em migração própria.

## Domínio (`packages/domain/src/budgets/`)

- `limitFor(versions: { effectiveFrom: Month; amountCents: bigint | null }[], month: Month): bigint | null`
- `budgetState(spentCents: bigint, limitCents: bigint): 'ok' | 'warning' | 'over'`
- `pace(spentCents: bigint, limitCents: bigint, day: number, daysInMonth: number): { projectedCents: bigint; overOnDay: number | null; dailyAllowanceCents: bigint | null } | null`
- `suggestBudget(monthlySpentCents: bigint[]): bigint | null`

## API

| Método | Rota | O que faz |
|---|---|---|
| GET | `/v1/budgets?month=YYYY-MM` | Orçamentos do mês (`BudgetMonth`). Sem `month`, usa o mês corrente; formato inválido ou mês futuro devolve 400. |
| PUT | `/v1/budgets/:categoryId` | `{ amountCents: Cents > 0 }`. Grava a partir do mês corrente e devolve o item atualizado. |
| DELETE | `/v1/budgets/:categoryId` | Grava "sem orçamento" a partir do mês corrente e devolve 204. Sem limite vigente, devolve 404. |
| POST | `/v1/budgets/apply-suggestions` | Cria orçamento para as categorias sem limite vigente que têm sugestão e devolve `{ created }`. |

Erros comuns às rotas:

- categoria inexistente, arquivada ou de outro workspace: 404;
- subcategoria, receita ou movimentação: 409, com a mensagem "Orçamento é por categoria principal de despesa.".

`BudgetMonth` (contrato em `packages/contracts/src/budgets.ts`):

```
{
  month, isCurrent, editable, asOfDay | null,
  totals: { budgetedCents, spentCents },       // só categorias com limite
  items: [{
    categoryId, label, limitCents | null, spentCents,
    share | null,                               // gasto / limite
    state: 'ok' | 'warning' | 'over' | null,
    pace: { projectedCents, overOnDay | null, dailyAllowanceCents | null } | null,
    suggestion: { amountCents, months } | null  // só no mês corrente e sem limite
  }]
}
```

- `items` lista todas as categorias principais de despesa ativas.
- Ordem: primeiro as que têm limite (`over`, depois `warning`, depois `ok`, cada grupo pela maior fração gasta); depois as sem limite, pelo maior gasto e, em empate, pelo nome.
- `editable` vale `isCurrent`.
- `GET /v1/analytics/month` ganha `limitCents | null` em cada categoria (sempre `null` em "Sem categoria") e `budgetAlerts: { warning, over }`.
- O gasto por categoria principal sai de uma função compartilhada com a agregação da F4a.

## Telas

`/painel/orcamentos` ganha o item "Orçamentos" na navegação, entre Transações e Revisão.

- **Cabeçalho:**
  - título "Orçamentos de {mês}", com a navegação de meses igual à da Início (`?mes=`);
  - régua do total ("R$ X de R$ Y orçados") quando houver algum limite;
  - em meses passados, o aviso "Orçamentos de meses passados não mudam.".
- **Seção "Com orçamento":** uma linha por categoria com:
  - nome e "R$ 612 de R$ 750";
  - `Scale` com `limit`, em que o excesso aparece em vermelho;
  - o estado: "82%, atenção", "Passou R$ 40" ou "{p}% usado";
  - no mês corrente, o ritmo: "No ritmo atual, fecha em R$ X" e, quando houver, "deve passar do limite por volta do dia N" ou "Dá pra gastar R$ Y por dia";
  - "Alterar", que abre o formulário de valor na própria linha;
  - "Remover", com confirmação.
- **Seção "Sem orçamento":** só no mês corrente. Cada categoria mostra o gasto do mês, o campo "Limite mensal para {categoria}" (pré-preenchido com a sugestão, quando houver, e com a dica "Sugestão: R$ X, mediana de N meses") e o botão "Definir orçamento".
- **Nenhum orçamento ainda:** o texto "Defina um limite mensal para as categorias que você quer acompanhar.". Com sugestões, aparece o botão "Usar sugestões", que pede confirmação listando os valores.
- **Formulário:** aceita "750" ou "750,00". Valor vazio, zero ou inválido mostra no campo "Informe um valor maior que zero, como 750,00.".
- **Início:**
  - em "Para onde foi", a categoria com limite ganha um traço vertical na posição do limite, na mesma escala da barra (ou no fim, se o limite for maior que a maior barra);
  - o nome acessível inclui "de {limite}";
  - quem passou mostra "Passou do orçamento" em vermelho;
  - abaixo da régua de renda, quando `warning + over > 0`, aparece o link "{n} em atenção, {m} passou" (só os termos maiores que zero) para `/painel/orcamentos`.

## Testes

- **Unitários:**
  - `limitFor`: versão vigente, mudança em outubro mantendo setembro, remoção, mês anterior a qualquer versão;
  - `budgetState`: 79,99%, 80% e 100%;
  - `pace`: dia 4 devolve `null`; dia 10 com projeção acima do limite dá o dia em que estoura; gasto acima do limite não tem `dailyAllowance`; arredondamentos;
  - `suggestBudget`: mediana com quantidade ímpar e par de meses, arredondamento para cima em R$ 50, mínimo de R$ 50, menos de 3 meses.
- **Integração (API):**
  - PUT e GET;
  - PUT de novo no mesmo mês sobrescreve;
  - vigência: versão antiga inserida com data passada continua valendo no mês anterior;
  - DELETE, e DELETE sem limite devolvendo 404;
  - 409 para subcategoria, receita e movimentação; 404 para categoria de outro workspace;
  - sugestão com 3 meses de histórico; apply-suggestions;
  - `limitCents` e `budgetAlerts` na analytics;
  - isolamento entre usuários;
  - 400 para mês inválido.
- **Integração (DB):** RLS de `budgets` (isolamento e cobertura de FORCE).
- **E2E:**
  - definir orçamento a partir da sugestão (com histórico lançado com data passada);
  - alterar;
  - passar do limite e ver "Passou" e o alerta na Início;
  - mês passado só leitura;
  - remover;
  - axe em `/painel/orcamentos`, nos temas claro e escuro.

## Fora de escopo

Gasto fixo contra variável, notificações, orçamento por subcategoria, metas e sobra de um mês passando para o seguinte.
