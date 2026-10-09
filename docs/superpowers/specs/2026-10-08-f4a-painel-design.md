# F4a: Painel do mês

> Status: aprovado em 2026-10-08. Orçamentos ficam para a F4b.

## Objetivo

A Início passa a responder "quanto sobrou neste mês", "para onde foi o dinheiro" e "como estou comparado ao mês passado". Os gráficos são próprios, em SVG renderizado no servidor, na identidade "Fita métrica".

Critérios de sucesso:

- Com uma entrada e duas saídas lançadas, a Início mostra o valor que sobrou, a régua com o percentual da renda gasta e as categorias das saídas.
- Dá para navegar entre meses. Cada categoria leva à lista de transações filtrada pela categoria e pelo mês.
- Nenhum gráfico depende de JavaScript no cliente, e cada um tem uma tabela equivalente acessível.

## Regras de cálculo

- **Mês:** o mês civil no fuso de São Paulo.
- **Entradas e saídas:**
  - entrada é a soma dos valores positivos do mês;
  - saída é a soma dos valores negativos, em valor absoluto;
  - lançamento em categoria do tipo `movement` fica fora das duas;
  - lançamento sem categoria conta normalmente.
- **Cartão:** conta na data da compra. Fatura e parcelas ficam para a F3.
- **Categoria raiz:** é `coalesce(parent_id, id)`. As filhas somam na raiz, e uma categoria arquivada continua somando com o nome que tinha.
- **Sobrou:** `entradas − saídas`. Se for negativo, a tela mostra "Faltou".
- **Renda gasta:** `saídas / entradas`. Sem entradas, o valor é `null`.
- **Comparação:**
  - no mês corrente, compara com o mês anterior até o mesmo dia, limitado ao último dia dele (31 de março vira 28 ou 29 de fevereiro);
  - num mês passado, compara o mês inteiro com o mês anterior inteiro;
  - a diferença é dada em pontos percentuais da renda gasta, e é `null` quando um dos dois meses não tem entradas.

## Domínio (`packages/domain/src/analytics/`)

Funções puras:

- `parseMonth(text)`: recebe `YYYY-MM` e devolve o mês ou `null`.
- `monthRange(month)`: devolve `{ from, to }` com o primeiro e o último dia, no formato `YYYY-MM-DD`.
- `previousMonth(month)` e `lastMonths(month, n)`: `lastMonths` devolve os n meses terminando em `month`, em ordem crescente.
- `comparisonCutoff(month, day)`: devolve a data do mesmo dia no mês anterior, limitada ao último dia dele.
- `spentShare(incomeCents, expenseCents)`: devolve um número (1 = 100%) ou `null`.
- `deltaPoints(current, previous)`: devolve pontos percentuais inteiros ou `null`.

## API

`GET /v1/analytics/month?month=YYYY-MM`:

- sem `month`, usa o mês corrente;
- formato inválido ou mês futuro devolve 400.

Resposta (`MonthSummary`, em `packages/contracts/src/analytics.ts`, com valores em centavos como string):

```
{
  month, isCurrent, asOfDay | null,
  incomeCents, expenseCents, netCents,
  comparison: { month, upToDay | null, incomeCents, expenseCents },
  categories: [{ categoryId | null, label, expenseCents, count }],
  pendingReview,
  history: [{ month, incomeCents, expenseCents }]
}
```

- **`asOfDay`:** o dia de hoje quando o mês é o corrente; senão `null`.
- **`categories`:** as saídas por categoria raiz, da maior para a menor. As sem categoria vêm com `categoryId: null` e o rótulo "Sem categoria".
- **`pendingReview`:** o mesmo número de "precisam de você" da revisão.
- **`history`:** 6 meses terminando no mês pedido. Meses sem lançamentos vêm zerados.
- **Cálculo:** tudo é agregado em SQL dentro de um único `withTenant`, usando o índice `(workspace_id, posted_date)`.

Mudança em `GET /v1/transactions?categoryId=`: quando o id é de uma categoria raiz, o filtro inclui as filhas.

## Tela (`/painel`)

- **Navegação:**
  - `?mes=YYYY-MM`, com os links "‹ {mês anterior}" e "{próximo mês} ›";
  - o link do próximo mês não aparece no mês corrente;
  - `?mes=` inválido ou futuro mostra o mês corrente com o aviso "Mês inválido, mostrando {mês}".
- **Destaque:**
  - "Sobrou em {mês}" (ou "Faltou em {mês}") com o valor em `Figure` grande;
  - abaixo, "Entrou R$ X · Saiu R$ Y";
  - a régua (`Scale`) mostra a renda gasta, com excesso acima de 100% em vermelho;
  - no mês corrente, uma marca na régua indica a renda gasta do mês anterior no mesmo dia, com o texto "67% da renda gasta · +9 p.p. que no dia 8 de setembro";
  - num mês passado, o texto fica "… que em agosto";
  - sem entradas: "Sem entradas neste mês.".
- **Para onde foi:**
  - as 6 maiores categorias raiz e "Outras N categorias" somadas;
  - cada barra é proporcional à maior;
  - cada linha é um link para `/painel/transacoes?categoryId=…&from=…&to=…`;
  - "Sem categoria" usa uma barra apagada e leva à Revisão, com o texto "{n} a revisar" quando `pendingReview > 0`.
- **Últimos 6 meses:**
  - pares de barras (entrou e saiu) com o mês escolhido destacado;
  - o rótulo de cada mês é um link para o painel daquele mês.
- **Acessibilidade:**
  - cada gráfico tem uma tabela equivalente visualmente oculta;
  - as barras são `aria-hidden`;
  - os links têm nome com o valor.
- **Estados vazios:**
  - sem conta ou sem nenhum lançamento: mantém o convite atual;
  - mês sem lançamentos: "Nada lançado em {mês}.", e os 6 meses continuam aparecendo.
- **Erro da API de analytics:** "Não foi possível carregar o resumo agora." O resto do painel continua funcionando.

## Testes

- **Unitários:**
  - `monthRange` com meses de 28, 29, 30 e 31 dias e virada de ano;
  - `previousMonth` e `lastMonths` na virada de ano;
  - `comparisonCutoff` (31/03 → 28/02 ou 29/02; 15/10 → 15/09);
  - `spentShare` e `deltaPoints` (sem entradas, acima de 100%, arredondamento).
- **Integração:**
  - totais (separa entrada e saída, exclui movimentação, conta sem categoria);
  - filha soma na raiz e arquivada continua somando;
  - comparação até o mesmo dia no mês corrente e mês inteiro no passado;
  - histórico de 6 meses com meses vazios;
  - isolamento entre usuários;
  - 400 para mês inválido ou futuro;
  - filtro `categoryId` com e sem filhas.
- **E2E:**
  - uma entrada e duas saídas mostram "Sobrou", a régua e as categorias;
  - clicar numa categoria abre a lista filtrada;
  - navegar para o mês anterior e voltar;
  - o link do próximo mês não aparece no mês corrente;
  - "Sem categoria" leva à Revisão;
  - axe na Início com dados, nos temas claro e escuro.

## Fora de escopo

Orçamentos (F4b), insights, metas, fatura, parcelas, gasto fixo contra variável e exportação.
