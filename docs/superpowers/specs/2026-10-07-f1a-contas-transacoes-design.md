# F1a — Contas, categorias e lançamentos manuais

> Status: aprovado em 2026-10-07. A importação (OFX/CSV, worker, deduplicação) é a F1b e tem spec próprio.

## Objetivo

Permitir que o usuário cadastre contas e cartões, lance transações à mão com categoria e veja a lista de transações com filtros e o saldo de cada conta. Isso cria o modelo de transações que a importação (F1b), a classificação (F2) e o dashboard (F4) vão usar.

Sucesso:

- Criar conta corrente, poupança, dinheiro ou cartão e ver o saldo (ou a fatura aberta) refletir os lançamentos.
- Lançar, editar e excluir transações com categoria da taxonomia padrão.
- Listar transações com filtros por conta, categoria, período e texto, paginadas.
- Nenhum dado de um workspace visível a outro (RLS + testes).

## Decisões

- **Interface:** Server Components leem pela API (`apiFetch`); formulários usam Server Actions que chamam a API repassando o cookie. Sem biblioteca de dados no cliente.
- **Categorias:** taxonomia padrão criada junto com o workspace pessoal; criar e editar categorias é F2.
- **Saldo:** saldo inicial em uma data + transações a partir dessa data. Cartão mostra fatura aberta.
- **Dinheiro:** `bigint` em centavos no banco e no domínio; na API trafega como string de inteiro com sinal (`"-4590"`).

## Modelo de dados

Todas as tabelas novas são de tenant: `workspace_id` com `ENABLE` e `FORCE ROW LEVEL SECURITY` e policy `USING/WITH CHECK (workspace_id = (SELECT app_workspace_id()))` (ADR 0002).

### `financial_accounts`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid pk | |
| `workspace_id` | uuid fk | |
| `name` | text | 1–60 caracteres |
| `type` | text | `checking` \| `savings` \| `cash` \| `credit_card` |
| `institution` | text null | até 60 caracteres |
| `opening_balance_cents` | bigint | 0 para cartão |
| `opening_balance_date` | date null | obrigatória exceto cartão |
| `closing_day`, `due_day` | smallint null | 1–31; obrigatórios só em cartão |
| `archived_at` | timestamptz null | |
| `created_at` | timestamptz | |

### `categories`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid pk | |
| `workspace_id` | uuid fk | |
| `parent_id` | uuid null fk | no máximo 2 níveis |
| `name` | text | |
| `kind` | text | `expense` \| `income` \| `movement` |
| `system_key` | text null | único por workspace (ex. `food.delivery`) |
| `archived_at` | timestamptz null | |

A taxonomia padrão (`DEFAULT_CATEGORIES`) é a do `docs/architecture.md` §10. Ela é inserida na mesma transação que cria o workspace pessoal, só quando o workspace é criado.

### `transactions`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid pk | |
| `workspace_id` | uuid fk | |
| `account_id` | uuid fk | conta do mesmo workspace |
| `category_id` | uuid null fk | categoria do mesmo workspace |
| `posted_date` | date | |
| `statement_month` | date null | 1º dia do mês da fatura; só em cartão; calculado no servidor |
| `amount_cents` | bigint | ≠ 0; `+` entrada, `−` saída |
| `description` | text | 1–140 caracteres |
| `notes` | text null | até 500 caracteres |
| `source` | text | `manual` (F1b adiciona `import`) |
| `created_at`, `updated_at` | timestamptz | |

Índices: `(workspace_id, posted_date desc, id desc)`, `(workspace_id, account_id, posted_date)`.

Chaves estrangeiras compostas com `workspace_id` (`(workspace_id, account_id)`, `(workspace_id, category_id)`, `(workspace_id, parent_id)`): o Postgres ignora RLS ao checar FK, então só a FK composta impede apontar para conta ou categoria de outro workspace.

O tipo da conta é imutável depois de criada. Alterar o dia de fechamento de um cartão recalcula o `statement_month` dos lançamentos dele.

## Regras de domínio (`packages/domain`)

- `statementMonth(postedDate, closingDay)`: o fechamento efetivo de um mês é `min(closingDay, último dia do mês)`. Compra até o fechamento efetivo vai para a fatura daquele mês; depois dele, para a do mês seguinte. Retorna o 1º dia do mês da fatura (`YYYY-MM-01`).
- `accountBalance(openingCents, openingDate, transactions)`: saldo inicial + soma das transações com `posted_date >= openingDate`.
- `openInvoice(transactions, month)`: valor devido da fatura `month` = −(soma dos `amount_cents` com `statement_month = month`).
- Datas são strings `YYYY-MM-DD` interpretadas no fuso `America/Sao_Paulo`; "hoje" é calculado nesse fuso.

## API

Todas com `requireAuth` e `withTenant`. Formato de erro: `{ "error": { "code": string, "message": string, "fields"?: Record<string, string> } }`. Códigos: 400 `validation`, 404 `not_found` (inclui recurso de outro tenant), 409 `conflict`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/v1/accounts` | contas não arquivadas, com `balanceCents` (não-cartão) ou `openInvoiceCents` e `currentStatementMonth` (cartão) |
| POST | `/v1/accounts` | cria |
| PATCH | `/v1/accounts/:id` | edita nome, instituição, saldo inicial, dias |
| DELETE | `/v1/accounts/:id` | arquiva |
| GET | `/v1/categories` | árvore (pais com `children`) |
| GET | `/v1/transactions` | filtros `accountId`, `categoryId`, `from`, `to`, `q`; `cursor`; 50 por página; ordem `posted_date desc, id desc` |
| POST | `/v1/transactions` | cria manual |
| PATCH | `/v1/transactions/:id` | edita |
| DELETE | `/v1/transactions/:id` | exclui |

O cursor é opaco (base64url de `posted_date|id`). `q` busca em `description` sem diferenciar maiúsculas (`ILIKE`, com `%` e `_` escapados). Criar transação em conta arquivada responde 409.

## Telas

Navegação lateral em `/painel` (Início, Transações, Contas); no celular vira barra no topo.

- **`/painel/contas`** — linhas com nome, instituição, tipo e saldo ou fatura aberta (`Figure` pequeno, tabular). Botão "Nova conta". Formulário em `/painel/contas/nova` e `/painel/contas/[id]`: os campos mudam com o tipo (cartão: fechamento e vencimento; demais: saldo inicial e data). Arquivar fica no formulário de edição.
- **`/painel/transacoes`** — tabela: data, descrição, categoria, conta, valor (à direita, tabular, sinal +/−, entradas em `gain`). Filtros por conta, categoria, período e busca, refletidos na URL. "Carregar mais" pagina. Botão "Novo lançamento".
- **`/painel/transacoes/nova` e `/painel/transacoes/[id]`** — tipo (Saída/Entrada), valor (aceita `1.234,56`), data (padrão: hoje), descrição, conta, categoria (filtrada pelo tipo: saída mostra `expense`, entrada mostra `income`; `movement` aparece nos dois), observação. Edição tem "Excluir lançamento" com confirmação.
- **`/painel`** — estado vazio com "Cadastrar conta" (sem contas) ou "Lançar transação" (com contas). Importação continua marcada como próxima fase.

Erros de validação aparecem no campo (`Field.error`); erros gerais em `role="alert"`.

## Testes

- Unitários: `statementMonth` (antes, no e depois do fechamento; fechamento 31 em fevereiro e em mês de 30 dias; virada de ano), `accountBalance`, `openInvoice`, integridade de `DEFAULT_CATEGORIES` (chaves únicas, pais existentes, 2 níveis).
- Integração DB: RLS nas três tabelas (sem contexto, outro tenant); seed de categorias uma vez só, também sob concorrência.
- Integração API: CRUD de contas e transações; validação; 404 para recurso de outro usuário; transação em conta de outro usuário recusada; paginação por cursor sem repetição nem buraco; filtros; saldo e fatura.
- E2E: criar conta e cartão, lançar saída e entrada, ver saldo e fatura, filtrar, editar e excluir; axe nas telas novas (claro e escuro).

## Fora de escopo

Importação, deduplicação, transferências entre contas, parcelas, criar/editar categorias, edição em massa, saldo histórico por data.
