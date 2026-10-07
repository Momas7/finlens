# F2a — Classificação automática e categorias editáveis

> Status: aprovado em 2026-10-08. Caixa de revisão, regras sugeridas, propagação e LLM ficam para a F2b, depois da importação (F1b).

## Objetivo

Classificar cada lançamento automaticamente, com confiança e explicação, aprendendo com as correções do usuário, e permitir que ele gerencie as próprias categorias. Medir a qualidade do classificador com um harness reproduzível.

Sucesso:

- Ao digitar "IFOOD*REST" no lançamento, a sugestão "Alimentação › Delivery" aparece com confiança e motivo.
- Depois de corrigir uma compra, a próxima compra parecida segue a correção.
- `pnpm eval:classifier` gera `docs/classifier-eval.md`; o CI falha se a precisão do automático ficar abaixo de 95%.
- Categorias podem ser criadas, renomeadas e arquivadas.

## Arquitetura

O motor é puro e fica em `packages/domain/src/classification/`: recebe a descrição, o valor e as evidências já buscadas, e devolve o resultado. A API busca as evidências (regras, histórico, similares) sob RLS e chama o motor. A classificação é síncrona.

```
descrição ─► normalize() ─► { normalized, tokens, gateway, installment }
                               │
   L1 regras  L2 histórico  L3 similares  L4 dicionário  L5 palavras-chave
        └──────────┴────────────┴──────────────┴──────────────┘
                               ▼
              combine() ─► { categoryKey|categoryId, confidence, status, source, explanation, merchantKey }
```

## Normalização (`normalize`)

1. Maiúsculas, sem acentos, espaços colapsados.
2. Remove prefixos de gateway e guarda qual foi: `PAG*`, `PAGSEGURO*`, `MP*`, `MERCADOPAGO*`, `PG *`, `IZ *`, `SUMUP *`, `EC *`, `PAYPAL *`, `EBANX*`, `PICPAY*`.
3. Remove marcadores de parcela e guarda `{ current, total }`: `PARC 04/12`, `PARCELA 4 DE 12`, `04/12` no fim (só quando `1 ≤ atual ≤ total ≤ 24`).
4. Remove ruído do fim: sigla de UF, `BR`/`BRA`, nomes de cidade comuns (lista fixa), datas `DD/MM`, sequências numéricas com 4 dígitos ou mais e `*` soltos.
5. Remove prefixos bancários: `COMPRA CARTAO`, `COMPRA NO DEBITO`, `DEB AUT`, `PAGTO`, `PIX ENVIADO` e `PIX RECEBIDO` (estes dois guardam `counterparty` com o restante).
6. `normalized` é o texto final; `tokens` são as palavras com 2 caracteres ou mais.

## Camadas

| Camada | Fonte | Confiança |
|---|---|---|
| L1 | Regra do usuário que casa (texto contido em `normalized` ou `merchantKey`, faixa de valor e conta opcionais). Maior prioridade, depois a mais recente. | 0,99 |
| L2 | Histórico de lançamentos `confirmed` com o mesmo `merchantKey` (ou o mesmo `normalized`, sem estabelecimento) | posterior abaixo |
| L3 | Até 10 lançamentos `confirmed` com `similarity(description_normalized) > 0,45` | voto ponderado, teto 0,85 |
| L4 | Dicionário de estabelecimentos | 0,90 |
| L5 | Palavras-chave (POSTO, DROGARIA, FARMACIA, SUPERMERCADO, PADARIA, RESTAURANTE, ESTACIONAMENTO, UBER, 99APP…) | 0,70–0,80 |

**Faixas de valor** (valor absoluto): `xs` < R$ 50, `sm` < R$ 200, `md` < R$ 1.000, `lg` ≥ R$ 1.000.

**L2, posterior com suavização (α = β = 1):**

```
P(c | m)    = n_c / (n + 1)
P(c | m, b) = (n_c,b + P(c | m)) / (n_b + 1)
```

`n` conta os confirmados do estabelecimento; `n_b` os da mesma faixa. A confiança de L2 é `P(c | m, b)` da melhor categoria. Exemplos: uma confirmação na faixa → 0,75; duas → 0,89; três → 0,94; dez Delivery seguidas de uma correção na mesma faixa → Delivery 0,90.

**L3:** voto de cada vizinho com peso igual à similaridade. Confiança = (soma dos pesos da melhor categoria / soma total) × min(1, vizinhos da melhor / 3) × 0,85.

## Combinação (`combine`)

1. L1 casou: decide sozinha.
2. Se L2 ou L3 têm candidatos, L4 e L5 são ignorados: o histórico do usuário vale mais que o dicionário global.
3. Entre as camadas restantes, candidatos da mesma categoria se reforçam por noisy-OR: `1 − Π(1 − cᵢ)`, com teto 0,99.
4. Conflito: se a segunda categoria tem confiança ≥ 0,80 vinda de outra camada, a confiança final é `min(melhor, 0,69)`.
5. Status: ≥ 0,90 `auto` (aplica); ≥ 0,70 `likely` (aplica, marcado como provável); < 0,70 `suggested` (não aplica; guarda a sugestão); sem candidatos: `none`.
6. Explicação vem da camada decisiva:
   - L1: `Regra: descrição contém "{padrão}".`
   - L2: `Você classificou {estabelecimento} como {categoria} {n} vez(es).`
   - L3: `Parecido com {k} lançamento(s) seu(s) em {categoria}.`
   - L4: `{Estabelecimento} costuma ser {categoria}.`
   - L5: `A descrição contém {palavra}.`
   - Com reforço: acrescenta ` Confirmado por {outra fonte}.`

## Dicionário de estabelecimentos

`packages/domain/src/classification/merchants.ts`: cerca de 150 marcas brasileiras, cada uma `{ key, name, patterns, categoryKey }`, onde `patterns` são textos normalizados e `categoryKey` é uma `system_key` da taxonomia padrão. Casamento: `normalized` começa com o padrão ou o contém em fronteira de palavra; vence o padrão mais longo. As chaves de categoria do dicionário são resolvidas para a categoria do workspace pela `system_key`; se o usuário arquivou essa categoria, o candidato é descartado.

## Dados

`transactions` ganha:

- `description_normalized text not null` (índice GIN `gin_trgm_ops`), `merchant_key text`;
- `classification_status text` (`auto` | `likely` | `suggested` | `confirmed` | `none`), `classification_source text` (`rule` | `history` | `similar` | `merchant` | `keyword` | `user`), `classification_confidence numeric(4,3)`, `classification_explanation text`;
- `suggested_category_id uuid` (FK composta com `workspace_id`).

Tabelas novas (RLS no padrão do ADR 0002, FKs compostas com `workspace_id`):

- `classification_rules`: `id`, `workspace_id`, `category_id`, `pattern` (texto normalizado), `min_amount_cents`, `max_amount_cents`, `account_id` (opcionais), `priority int default 0`, `created_at`.
- `classification_feedback`: `id`, `workspace_id`, `transaction_id` (`on delete set null`), `predicted_category_id`, `predicted_confidence`, `predicted_source`, `chosen_category_id`, `merchant_key`, `description_normalized`, `amount_bucket`, `created_at`.

`categories` ganha unicidade de nome entre irmãs ativas (`lower(name)`, por `parent_id`).

Regras de aprendizado:

- Só lançamentos `confirmed` alimentam L2 e L3.
- Lançamento `confirmed` nunca é reclassificado automaticamente.
- Ao salvar com categoria escolhida (criação ou edição), o lançamento fica `confirmed`, `source = user`, e um `classification_feedback` registra a previsão do motor naquele momento.
- Lançamentos existentes da F1a: a migration preenche `description_normalized` (normalização em SQL simplificada; o próximo PATCH recalcula com a função completa) e marca `confirmed` os que têm categoria, `none` os demais.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/v1/classify?description&amountCents&accountId` | classifica sem gravar |
| POST/PATCH | `/v1/transactions` | `categoryId`: `"auto"` (padrão quando omitido no POST), UUID ou `null` |
| POST | `/v1/categories` | `{ name, parentId? }`; filha herda `kind`; no máximo 2 níveis |
| PATCH | `/v1/categories/:id` | `{ name }` |
| DELETE | `/v1/categories/:id` | arquiva a categoria e as filhas |
| GET/POST | `/v1/classification-rules` | lista / cria `{ categoryId, pattern, minAmountCents?, maxAmountCents?, accountId? }` |
| DELETE | `/v1/classification-rules/:id` | exclui |

`Transaction` ganha `classificationStatus`, `classificationSource`, `classificationConfidence` (número 0–1 ou null), `classificationExplanation`, `suggestedCategoryId`, `merchantKey`. Erros: 409 para nome duplicado entre irmãs, terceiro nível ou categoria arquivada; 404 para recurso de outro workspace.

## Telas

- **Formulário de lançamento:** opção "Automática" no topo do seletor de categoria (padrão em lançamento novo). Ao digitar a descrição (espera de 300 ms), aparece abaixo uma linha com a categoria sugerida, a régua de confiança, o percentual e o motivo; escolhendo outra categoria, a linha diz "Você escolheu".
- **Lista de transações:** sob a categoria, texto discreto "automática", "provável" ou "sugestão: {categoria}"; confirmados sem marca.
- **Edição:** painel "Por que esta categoria?" (explicação, régua, fonte) e botão "Sempre classificar assim", que cria a regra com o `normalized` como padrão.
- **`/painel/categorias`:** árvore com criar raiz ou filha, renomear e arquivar; abaixo, "Suas regras" com excluir.

## Harness de avaliação

`tools/classifier-eval/`:

- `dataset.ts`: cerca de 300 lançamentos sintéticos e determinísticos no formato dos extratos brasileiros (marcas do dicionário com sufixos variados, comércios locais desconhecidos repetidos, PIX para pessoas, casos ambíguos como Amazon em faixas diferentes), cada um com a `system_key` esperada.
- `run.ts`: classifica na ordem; depois de cada lançamento, simula o usuário confirmando a categoria esperada (alimenta L2/L3 em memória; L3 usa similaridade trigram calculada em TS).
- Métricas: % `auto`, % `likely`, % `suggested`/`none`; precisão de `auto` e de `likely`; precisão por fonte; calibração por faixa de confiança; precisão nas primeiras 100 contra as últimas 100.
- `pnpm eval:classifier` grava `docs/classifier-eval.md`; `--check` sai com erro se a precisão de `auto` for menor que 95%. O CI roda com `--check`.

## Testes

- Unitários (domínio): normalização (≥ 40 casos reais de formato), faixas, posterior de L2, voto de L3, combinação (reforço, conflito, prioridade do histórico sobre o dicionário), explicações, dicionário (sem padrão duplicado; toda `categoryKey` existe em `DEFAULT_CATEGORIES`).
- Integração: `GET /v1/classify` sem gravar; POST "auto" aplica e grava campos; correção gera feedback e ensina o próximo; `confirmed` não é reclassificado; regras; CRUD de categorias (duplicado, terceiro nível, arquivar com filhas); RLS das tabelas novas; categoria ou regra de outro workspace → 404.
- E2E: sugestão ao digitar; salvar em automático; corrigir Amazon → Casa e ver a próxima Amazon parecida seguir; criar e arquivar categoria; criar regra pela edição; axe nas telas novas.

## Fora de escopo

Caixa de revisão, regras sugeridas, propagação para semelhantes, LLM, embeddings, split de transação, reclassificação em massa.
