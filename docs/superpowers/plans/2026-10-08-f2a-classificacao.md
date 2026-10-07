# F2a — Classificação automática e categorias editáveis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Motor de classificação em camadas (puro, no domínio), aplicado aos lançamentos com confiança e explicação, aprendendo com correções; categorias e regras editáveis; harness de avaliação no CI.

**Architecture:** `packages/domain/src/classification/` contém normalização, dicionário, camadas, combinação e explicações, sem I/O. A API (`modules/classification`) busca evidências sob RLS e chama o motor em `GET /v1/classify` e ao salvar lançamentos. O harness em `tools/classifier-eval` usa o mesmo motor com histórico em memória.

**Tech Stack:** TypeScript, Vitest, Drizzle + PostgreSQL 17 (`pg_trgm`, RLS), Fastify 5 + Zod 4, Next.js 16, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-08-f2a-classificacao-design.md`

## Global Constraints

- Limiares: `auto` ≥ 0,90; `likely` ≥ 0,70; `suggested` < 0,70; sem candidatos `none`.
- Confianças: L1 0,99; L4 0,90; L5 0,70–0,80; L3 teto 0,85; noisy-OR com teto 0,99; conflito ≥ 0,80 de outra camada → `min(melhor, 0,69)`.
- L2: `P(c|m) = n_c/(n+1)`; `P(c|m,b) = (n_c,b + P(c|m))/(n_b+1)`.
- Faixas: `xs` < 5000 centavos, `sm` < 20000, `md` < 100000, `lg` ≥ 100000 (valor absoluto).
- L3: até 10 vizinhos `confirmed` com similaridade > 0,45.
- Só lançamentos `confirmed` ensinam; `confirmed` nunca é reclassificado sozinho.
- Tabelas novas: RLS `ENABLE` + `FORCE`, FKs compostas com `workspace_id`; o teste de cobertura de RLS existente deve continuar passando.
- Categorias: no máximo 2 níveis; nome 1–40 caracteres, único entre irmãs ativas sem diferenciar maiúsculas.
- Textos da interface em pt-BR, sentence case; identidade visual vigente (`Scale`, `Field`, `Select`, `Panel`, tokens).
- Commits sem linha de coautoria.

## Review Focus

1. **Descrição que normaliza para vazio** ("PIX ENVIADO", "****"): esperado `normalized = ''`, status `none`, nada quebra. — Task 1 e Task 5.
2. **Categoria do dicionário arquivada pelo usuário**: esperado o candidato descartado, nunca aplicar categoria arquivada. — Task 5.
3. **Regra apontando para categoria arquivada**: esperado regra ignorada na classificação. — Task 5.
4. **Padrão de regra com caracteres especiais** ("50% OFF", "C&A", "(SP)"): esperado casamento literal. — Task 2.
5. **Editar a descrição de um lançamento `confirmed`**: esperado `description_normalized` recalculado e categoria mantida. — Task 5.

---

## File Structure

```
packages/domain/src/classification/
  normalize.ts            normalize(), amountBucket()
  merchants.ts            MERCHANTS, matchMerchant()
  keywords.ts             KEYWORDS, matchKeyword()
  layers.ts               historyCandidates(), similarCandidates(), ruleMatches()
  combine.ts              combine(), statusFor()
  explain.ts              explanation templates
  classify.ts             classify(input, evidence) — orquestra camadas
  trigram.ts              trigramSimilarity() (para o harness)
  index.ts
packages/db/src/schema/finance.ts (+ classification tables), migrations 0005+
apps/api/src/modules/classification/{evidence,service,routes}.ts
apps/api/src/modules/categories/routes.ts (CRUD), modules/rules/routes.ts
apps/web/src/app/painel/transacoes/{transaction-form,category-suggestion,why-panel}.tsx
apps/web/src/app/painel/categorias/{page,category-tree,actions}.tsx
tools/classifier-eval/{package.json,dataset.ts,run.ts}
docs/classifier-eval.md (gerado)
```

---

### Task 1: Normalização e faixas

**Files:** Create `packages/domain/src/classification/normalize.ts`, `index.ts`; export em `packages/domain/src/index.ts`. Test: `normalize.test.ts`.

**Interfaces — Produces:**
- `type Normalized = { normalized: string; tokens: string[]; gateway: string | null; installment: { current: number; total: number } | null; counterparty: string | null }`
- `normalize(raw: string): Normalized`
- `type AmountBucket = 'xs' | 'sm' | 'md' | 'lg'`; `amountBucket(cents: bigint): AmountBucket` (usa valor absoluto)

- [ ] **Step 1: Write the failing tests** — tabela `it.each` com pelo menos 40 pares `[raw, normalized]` cobrindo as regras do spec, incluindo:

```ts
['IFOOD*REST', 'IFOOD REST'],
['UBER *TRIP', 'UBER TRIP'],
['NETFLIX.COM', 'NETFLIX COM'],
['PAG*ACADEMIA SMART FIT', 'ACADEMIA SMART FIT'],
['MP*MERCADOLIVRE', 'MERCADOLIVRE'],
['MERCADOPAGO*PADARIA SAO JOAO', 'PADARIA SAO JOAO'],
['PG *TON CAFE DA MANHA', 'TON CAFE DA MANHA'],
['IZ *BARRACA DO ZE', 'BARRACA DO ZE'],
['SUMUP *ACAI PRAIA', 'ACAI PRAIA'],
['PAYPAL *STEAM GAMES', 'STEAM GAMES'],
['POSTO IPIRANGA SAO PAULO SP', 'POSTO IPIRANGA'],
['DROGASIL 1234 BELO HORIZONTE BR', 'DROGASIL'],
['AMAZON BR', 'AMAZON'],
['COMPRA CARTAO PADARIA REAL', 'PADARIA REAL'],
['PIX ENVIADO MARIA CLARA', 'MARIA CLARA'],
['NOTEBOOK DELL PARC 04/12', 'NOTEBOOK DELL'],
['Café Três Corações', 'CAFE TRES CORACOES'],
['PIX ENVIADO', ''],
['****', ''],
```

e asserts específicos: `normalize('NOTEBOOK DELL PARC 04/12').installment` = `{ current: 4, total: 12 }`; `normalize('MP*X').gateway` = `'MP'`; `normalize('PIX ENVIADO MARIA CLARA').counterparty` = `'MARIA CLARA'`; `normalize('LOJA 12/10').installment` = `{ current: 12, total: 10 }` **não** (atual > total → `null`, e `12/10` removido como data); `amountBucket(-4999n)` = `'xs'`, `5000n` = `'sm'`, `19999n` = `'sm'`, `20000n` = `'md'`, `100000n` = `'lg'`.

- [ ] **Step 2: Run** `pnpm --filter @finlens/domain test` — Expected: FAIL.
- [ ] **Step 3: Implement** — ordem do spec; lista fixa de cidades (`SAO PAULO`, `RIO DE JANEIRO`, `BELO HORIZONTE`, `CURITIBA`, `PORTO ALEGRE`, `SALVADOR`, `RECIFE`, `FORTALEZA`, `BRASILIA`, `CAMPINAS`, `GOIANIA`, `MANAUS`, `BELEM`, `FLORIANOPOLIS`, `VITORIA`, `OSASCO`, `SANTOS`) e UFs.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(domain): normalize bank descriptions and bucket amounts`

---

### Task 2: Dicionário, palavras-chave, camadas, combinação e explicação

**Files:** Create `merchants.ts`, `keywords.ts`, `layers.ts`, `combine.ts`, `explain.ts`, `classify.ts`, `trigram.ts` em `packages/domain/src/classification/`. Test: um `*.test.ts` por arquivo.

**Interfaces:**
- Consumes: `normalize`, `amountBucket` (Task 1), `DEFAULT_CATEGORIES`.
- Produces:
  - `type Merchant = { key: string; name: string; patterns: string[]; categoryKey: string }`; `MERCHANTS: readonly Merchant[]`; `matchMerchant(normalized: string): Merchant | null` (início ou fronteira de palavra; vence padrão mais longo).
  - `matchKeyword(tokens: string[]): { keyword: string; categoryKey: string; confidence: number } | null`.
  - `type Source = 'rule' | 'history' | 'similar' | 'merchant' | 'keyword'`
  - `type Candidate = { category: string; confidence: number; source: Source; detail: ExplainDetail }` — `category` é id da categoria do workspace (L1–L3) ou `system_key` resolvida pela API (L4–L5); o motor só compara strings.
  - `type ExplainDetail = { pattern?: string; merchantName?: string; count?: number; neighbors?: number; keyword?: string; categoryName: string }`
  - `type Rule = { id: string; categoryId: string; categoryName: string; pattern: string; minAmountCents: bigint | null; maxAmountCents: bigint | null; accountId: string | null; priority: number; createdAt: string }`
  - `ruleMatches(rules: Rule[], ctx: { normalized: string; merchantKey: string | null; amountCents: bigint; accountId: string | null }): Rule | null` — casamento literal por `includes`.
  - `type HistoryRow = { categoryId: string; categoryName: string; bucket: AmountBucket; count: number }`
  - `historyCandidates(rows: HistoryRow[], bucket: AmountBucket, merchantName: string): Candidate[]` — fórmula do spec.
  - `type Neighbor = { categoryId: string; categoryName: string; similarity: number }`
  - `similarCandidates(neighbors: Neighbor[]): Candidate[]`
  - `type Classification = { category: string | null; confidence: number; status: 'auto' | 'likely' | 'suggested' | 'none'; source: Source | null; explanation: string | null; merchantKey: string | null; normalized: string }`
  - `combine(candidates: Candidate[]): Omit<Classification, 'merchantKey' | 'normalized'>`
  - `type Evidence = { rules: Rule[]; history: HistoryRow[]; neighbors: Neighbor[]; resolveSystemKey(key: string): { id: string; name: string } | null }`
  - `classify(input: { description: string; amountCents: bigint; accountId: string | null }, evidence: Evidence): Classification` — L4/L5 usam `resolveSystemKey`; candidato com chave não resolvida é descartado.
  - `trigramSimilarity(a: string, b: string): number` — mesma definição do `pg_trgm` (trigramas com padding de dois espaços à esquerda e um à direita por palavra, `|A∩B| / |A∪B|`).

- [ ] **Step 1: Write the failing tests** (asserts principais):

```ts
// merchants.test.ts
it('chaves únicas, padrões sem duplicata e categoryKey válida', …);
it.each([['IFOOD REST', 'ifood'], ['UBER TRIP', 'uber'], ['UBER EATS PEDIDO', 'uber_eats'], ['NETFLIX COM', 'netflix'], ['POSTO IPIRANGA', 'ipiranga'], ['DROGASIL', 'drogasil'], ['AMAZON', 'amazon'], ['MERCADOLIVRE', 'mercadolivre'], ['STEAM GAMES', 'steam'], ['SPOTIFY', 'spotify'], ['CARREFOUR', 'carrefour']])('%s → %s', …);
it('não casa no meio da palavra', () => expect(matchMerchant('SUBUBER')).toBeNull());
expect(MERCHANTS.length).toBeGreaterThanOrEqual(150);

// layers.test.ts
it('L2 uma confirmação na faixa = 0,75', () => expect(historyCandidates([{ categoryId: 'd', categoryName: 'Delivery', bucket: 'xs', count: 1 }], 'xs', 'iFood')[0]?.confidence).toBeCloseTo(0.75, 3));
it('L2 três confirmações = 0,9375', …count 3 → 0.9375);
it('L2 dez + uma correção na faixa = Delivery 0,903', …rows d:10, x:1 mesma faixa → d ≈ 0.903);
it('L2 outra faixa = P(c|m)', …3 em 'xs', pergunta 'md' → 0.75);
it('L3 voto ponderado com teto', …3 vizinhos iguais sim 0.9 → 0.85; 1 vizinho → 0.85/3);
it('regra casa literal com caracteres especiais', () => expect(ruleMatches([rule('50% OFF')], ctx('LOJA 50% OFF'))?.id).toBe(…));
it('regra respeita faixa de valor e conta', …);
it('regra mais prioritária e depois mais recente vence', …);

// combine.test.ts
it('reforço noisy-OR: 0,90 + 0,75 mesma categoria = 0,975', …);
it('conflito ≥ 0,80 derruba para 0,69', …);
it('regra decide sozinha', …);
it('status por limiar', () => { expect(statusFor(0.9)).toBe('auto'); expect(statusFor(0.899)).toBe('likely'); expect(statusFor(0.7)).toBe('likely'); expect(statusFor(0.69)).toBe('suggested'); });
it('sem candidatos = none', …);

// classify.test.ts
it('IFOOD*REST sem histórico = Delivery 0,90 auto pelo dicionário', …);
it('histórico do usuário vence o dicionário', …history Restaurante 1 confirmação → Restaurante 0,75 likely, L4 ignorada);
it('categoria do dicionário não resolvida é descartada', …resolveSystemKey retorna null → none);
it('descrição vazia = none', () => expect(classify({ description: 'PIX ENVIADO', amountCents: -100n, accountId: null }, empty).status).toBe('none'));
it('explicações', …textos exatos do spec para cada fonte, incluindo " Confirmado por …");

// trigram.test.ts
it('igual a 1, disjunto a 0, parecido > 0,45', () => { expect(trigramSimilarity('MARIA CLARA', 'MARIA CLARA')).toBe(1); expect(trigramSimilarity('MARIA CL', 'MARIA CLARA')).toBeGreaterThan(0.45); expect(trigramSimilarity('ABC', 'XYZ')).toBe(0); });
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** Dicionário com ≥ 150 marcas cobrindo: delivery (iFood, Rappi, Uber Eats, Zé Delivery), transporte (Uber, 99, Cabify, BlaBlaCar, Sem Parar, ConectCar, Veloe), combustível (Ipiranga, Shell, BR/Petrobras, Ale), mercados (Carrefour, Pão de Açúcar, Extra, Assaí, Atacadão, Dia, Big, Sams Club, Makro, Oba, Hirota, St Marche, Zona Sul, Savegnago, Condor, Angeloni, Muffato, Bretas, Sonda, Mambo, Tenda), farmácias (Drogasil, Droga Raia, Pague Menos, Panvel, Drogaria São Paulo, Pacheco, Ultrafarma, Venancio, Araujo, Nissei), assinaturas (Netflix, Spotify, Disney, HBO/Max, Prime Video, Globoplay, Deezer, YouTube Premium, Apple, iCloud, Google One, Microsoft, Adobe, Crunchyroll, Paramount, Star Plus, Twitch, ChatGPT/OpenAI, Claude/Anthropic, Dropbox, Canva, Notion, GitHub), compras (Amazon, Mercado Livre, Magalu, Americanas, Shopee, AliExpress, Shein, Casas Bahia, Ponto, Kabum, Pichau, Terabyte, Leroy Merlin, Tok&Stok, Camicado, C&A, Renner, Riachuelo, Marisa, Zara, Centauro, Netshoes, Decathlon, Havan, Submarino), restaurantes e lanches (McDonald's, Burger King, Bobs, Habibs, Subway, Outback, Madero, Starbucks, Coco Bambu, Spoleto, Giraffas, China in Box, Pizza Hut, Dominos, KFC, Popeyes, Cacau Show, Kopenhagen), lazer (Steam, PlayStation, Xbox, Nintendo, Epic Games, Riot, Cinemark, Cinépolis, UCI, Ingresso.com, Sympla, Eventim), viagens (Latam, Gol, Azul, Booking, Airbnb, Decolar, 123milhas, Hoteis.com), saúde (Smart Fit, Bluefit, Bodytech, Selfit, Gympass/Wellhub, Unimed, Amil, SulAmerica, Hapvida, Bradesco Saúde, Dasa, Fleury, Lavoisier), contas da casa (Enel, Light, Cemig, Copel, CPFL, Celesc, Coelba, Sabesp, Cedae, Copasa, Comgas, Naturgy, Vivo, Claro, TIM, Oi, NET), educação (Udemy, Alura, Coursera, Duolingo), pets (Petz, Cobasi, Petlove), financeiro (IOF, "TARIFA", "ANUIDADE" via palavras-chave). Palavras-chave com confiança: POSTO/AUTO POSTO 0,80 (`transport.fuel`), DROGARIA/FARMACIA 0,80 (`health.pharmacy`), SUPERMERCADO/MERCADO/ATACADO/HORTIFRUTI 0,75 (`food.groceries`), PADARIA/PANIFICADORA 0,78 (`food.bakery`), RESTAURANTE/CHURRASCARIA/PIZZARIA 0,75 (`food.restaurants`), LANCHONETE/CAFE/CAFETERIA 0,72 (`food.snacks`), ESTACIONAMENTO/PEDAGIO 0,78 (`transport.parking_tolls`), ACADEMIA 0,75 (`health.gym`), PET 0,72 (`pets`), IOF 0,80 (`financial.iof`), TARIFA/ANUIDADE 0,78 (`financial.fees`), JUROS 0,80 (`financial.interest`), SALARIO 0,80 (`income.salary`), PAGAMENTO FATURA 0,80 (`movement.card_payment`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(domain): layered transaction classifier with explanations`

---

### Task 3: Harness de avaliação

**Files:** Create `tools/classifier-eval/{package.json,tsconfig.json,dataset.ts,run.ts}`; Modify `pnpm-workspace.yaml` (+ `tools/*`), `package.json` raiz (script `eval:classifier`), `.github/workflows/ci.yml` (passo no job `checks`). Output: `docs/classifier-eval.md`.

**Interfaces:**
- Consumes: `classify`, `normalize`, `amountBucket`, `matchMerchant`, `trigramSimilarity`, `DEFAULT_CATEGORIES`.
- Produces: `type Sample = { description: string; amountCents: bigint; expected: string /* system_key */ }`; `DATASET: Sample[]` (≈ 300, gerado deterministicamente com PRNG `mulberry32(42)`); `run(dataset): Report`; CLI `tsx run.ts [--check] [--out docs/classifier-eval.md]`.

- [ ] **Step 1: Write the failing test** — `tools/classifier-eval/run.test.ts`:

```ts
it('relatório consistente', () => {
  const r = run(DATASET);
  expect(r.total).toBe(DATASET.length);
  expect(r.auto + r.likely + r.suggested + r.none).toBe(r.total);
  expect(r.autoPrecision).toBeGreaterThanOrEqual(0.95);
  expect(DATASET.length).toBeGreaterThanOrEqual(300);
});
it('aprende: precisão das últimas 100 ≥ primeiras 100', () => { const r = run(DATASET); expect(r.lastHundredAccuracy).toBeGreaterThanOrEqual(r.firstHundredAccuracy); });
```

- [ ] **Step 2: Run** `pnpm --filter @finlens/classifier-eval test` — Expected: FAIL.
- [ ] **Step 3: Implement.** Evidência em memória: ao confirmar, guarda `{ merchantKey|normalized, bucket, systemKey, normalized }`; `history` filtra pela chave; `neighbors` usa `trigramSimilarity` > 0,45, top 10. Categorias identificadas pela própria `system_key` (`resolveSystemKey(k) = { id: k, name: k }`). Relatório markdown com: resumo, tabela por status, precisão por fonte, calibração em faixas `[0,7–0,8)`, `[0,8–0,9)`, `[0,9–0,95)`, `[0,95–1]`, curva primeiras/últimas 100 e data de geração.
- [ ] **Step 4: Run** test e `pnpm eval:classifier -- --check` — Expected: PASS e `docs/classifier-eval.md` escrito.
- [ ] **Step 5: Commit** — `feat(tools): classifier evaluation harness with CI gate`

---

### Task 4: Banco — colunas, tabelas, RLS e backfill

**Files:** Modify `packages/db/src/schema/finance.ts`; Create migration gerada + custom `classification_rls_backfill`. Test: `packages/db/test/classification.integration.test.ts`.

**Interfaces — Produces:** colunas e tabelas do spec em Drizzle (`classificationRules`, `classificationFeedback`); índice `transactions_description_trgm_idx` (`gin (description_normalized gin_trgm_ops)`); índice único `categories_sibling_name_idx` em `(workspace_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'), lower(name)) where archived_at is null`; `transactions.source` aceita só `manual` (inalterado).

- [ ] **Step 1: Write the failing tests:** RLS das duas tabelas (sem contexto 0 linhas; outro tenant não vê); regra apontando para categoria de outro workspace rejeitada por FK; apagar transação mantém feedback com `transaction_id` nulo; nome de categoria duplicado entre irmãs ativas rejeitado (`/unique/`), permitido após arquivar a primeira; defaults: transação inserida sem as colunas novas recebe `description_normalized = ''` e `classification_status = 'none'`. O backfill da migration é verificado manualmente no banco de dev (`select classification_status, count(*) from transactions group by 1`).
- [ ] **Step 2: Run** `pnpm --filter @finlens/db test:integration` — Expected: FAIL.
- [ ] **Step 3: Implement.** Backfill na migration custom: `update transactions set description_normalized = upper(regexp_replace(description, '\s+', ' ', 'g')), classification_status = case when category_id is null then 'none' else 'confirmed' end, classification_source = case when category_id is null then null else 'user' end`.
- [ ] **Step 4: Run** — Expected: PASS (inclui teste de cobertura de RLS). `pnpm --filter @finlens/db db:migrate` no dev.
- [ ] **Step 5: Commit** — `feat(db): classification columns, rules and feedback tables`

---

### Task 5: API — classificar, aplicar ao salvar e aprender

**Files:** Create `apps/api/src/modules/classification/{evidence,service,routes}.ts`; Modify `apps/api/src/modules/transactions/{routes,repository}.ts`, `packages/contracts/src/{transactions,classification}.ts`, `apps/api/src/app.ts`. Test: `apps/api/test/classification.integration.test.ts`.

**Interfaces:**
- Consumes: `classify`, `normalize`, `amountBucket` (Tasks 1–2); tabelas (Task 4).
- Produces:
  - `loadEvidence(tx: Tx, ctx: { normalized: string; merchantKey: string | null; excludeTransactionId?: string }): Promise<Evidence>` — rules com categoria ativa; history agrupado por `(category_id, bucket)` dos `confirmed` com mesma chave (`merchant_key` ou, sem estabelecimento, `description_normalized`), só categorias ativas; neighbors via `similarity(description_normalized, :n) > 0.45` top 10 `confirmed`, categorias ativas; `resolveSystemKey` sobre categorias ativas do workspace.
  - `classifyFor(tx, input: { description: string; amountCents: bigint; accountId: string | null; excludeTransactionId?: string }): Promise<Classification>`
  - Contrato `ClassificationResult = { categoryId: string|null; categoryLabel: string|null; confidence: number; status; source; explanation: string|null; merchantKey: string|null }`; `GET /v1/classify` (query `description` 1–140, `amountCents` Cents, `accountId?` Uuid).
  - `TransactionCreate.categoryId`: `Uuid | null | 'auto'`, default `'auto'`; `TransactionUpdate.categoryId` igual sem default. `Transaction` + campos do spec (`classificationConfidence: number | null`).
  - Ao salvar: `'auto'` → aplica (`auto`/`likely` gravam `category_id`; `suggested` grava só `suggested_category_id`; `none` limpa ambos); UUID → `confirmed`, `source = 'user'`, confiança 1, explicação `null`, e insere `classification_feedback` com a previsão de `classifyFor` (excluindo o próprio lançamento); `null` → sem categoria, status `none`, sem feedback. PATCH que muda só descrição/valor de um `confirmed` recalcula `description_normalized`/`merchant_key` e mantém categoria.

- [ ] **Step 1: Write the failing tests:**

```ts
it('GET /v1/classify não grava e sugere Delivery para IFOOD*REST', …status auto, confidence 0.9, explanation 'iFood costuma ser Delivery.', contagem de transações inalterada);
it('POST sem categoria aplica automática', …IFOOD*REST → categoryId = Delivery, classificationStatus 'auto', source 'merchant');
it('correção ensina o próximo', …AMAZON BR R$ 349,90 auto → PATCH categoryId Casa (confirmed, feedback 1 linha com predicted Outras compras); novo AMAZON BR R$ 299,00 → Casa, likely 0.75, source history);
it('confirmed não é reclassificado ao editar descrição', …lançamento confirmed em Mercado; PATCH description 'IFOOD*REST' → categoria continua Mercado, description_normalized 'IFOOD REST');
it('categoria do dicionário arquivada é ignorada', …arquiva Delivery; IFOOD*REST → none ou outra fonte, nunca Delivery);
it('regra com categoria arquivada é ignorada', …);
it('descrição vazia após normalizar', …'PIX ENVIADO' → status none, 201);
it('sugestão abaixo de 0,70 não aplica', …histórico em conflito → suggested, category_id null, suggestedCategoryId preenchido);
```

- [ ] **Step 2: Run** `pnpm --filter @finlens/api test:integration` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS (inclui suites antigas).
- [ ] **Step 5: Commit** — `feat(api): classify transactions on save and learn from corrections`

---

### Task 6: API — categorias e regras

**Files:** Modify `apps/api/src/modules/categories/routes.ts`; Create `apps/api/src/modules/rules/routes.ts`, contratos `CategoryCreate`, `CategoryUpdate`, `ClassificationRule`, `ClassificationRuleCreate`. Test: `apps/api/test/categories.integration.test.ts`.

**Interfaces — Produces:** rotas do spec. `CategoryCreate = { name: 1–40 trim, parentId?: Uuid }`; `CategoryUpdate = { name }` strict; `ClassificationRuleCreate = { categoryId: Uuid, pattern: string (normalizado no servidor; 2–100 após normalizar), minAmountCents?: Cents, maxAmountCents?: Cents, accountId?: Uuid }`; `ClassificationRule` = criação + `id`, `categoryLabel`, `createdAt`. `GET /v1/categories` continua devolvendo só ativas.

- [ ] **Step 1: Write the failing tests:** criar raiz (kind `expense`) e filha (herda kind); terceiro nível → 409; duplicado entre irmãs (case-insensitive) → 409; renomear; arquivar raiz arquiva filhas e somem do GET; criar filha em pai arquivado → 409; categoria de outro usuário → 404; regra: criar com padrão `'padaria são joão'` grava `'PADARIA SAO JOAO'`; padrão vazio após normalizar → 400; listar; excluir; regra de outro usuário → 404; regra com categoria de outro usuário → 404.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** Categoria nova de raiz: `kind` vem do body? Não — raiz criada pelo usuário é sempre `expense` (o spec não oferece outro tipo para raiz; receitas usam subcategorias de "Receitas").
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(api): manage categories and classification rules`

---

### Task 7: Web — sugestão no lançamento, marcas na lista e "Por que"

**Files:** Modify `apps/web/src/app/painel/transacoes/{transaction-form.tsx,page.tsx,actions.ts}`, `apps/web/src/app/painel/transacoes/[id]/page.tsx`; Create `category-suggestion.tsx`, `[id]/why-panel.tsx`, `[id]/rule-button.tsx`. Test: `apps/web/e2e/classificacao.spec.ts`, `e2e/a11y.spec.ts`.

**Interfaces:** Consumes contratos da Task 5–6. `CategorySuggestion` é client component: busca `/v1/classify` (same-origin) com debounce 300 ms e `AbortController`; mostra `Scale` pequena (`max=100`), percentual, categoria e explicação; `aria-live="polite"`. Seletor de categoria: primeira opção `value="auto"` rótulo "Automática" (padrão em lançamento novo; na edição, padrão é a categoria atual). Action envia `categoryId: 'auto' | uuid | null` ("Sem categoria" = `null`).

- [ ] **Step 1: Write the failing e2e:**

```ts
test('sugestão ao digitar e salvar automática', …digita 'IFOOD*REST' → texto 'Alimentação › Delivery' e '90%' visíveis na região de sugestão; salva sem tocar na categoria → linha com 'Alimentação › Delivery' e 'automática');
test('correção ensina a próxima compra parecida', …lança 'AMAZON BR' 349,90 (automática Compras › Outras compras); edita categoria para 'Compras › Casa e decoração'; novo 'AMAZON BR' 299,00 → sugestão 'Compras › Casa e decoração' e 'provável' na lista);
test('por que e regra', …abre lançamento automático → painel 'Por que esta categoria?' com explicação; 'Sempre classificar assim' → toast/texto 'Regra criada.');
// a11y: /painel/transacoes/nova com sugestão visível
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter @finlens/web test:e2e` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): category suggestions, classification markers and explanations`

---

### Task 8: Web — tela de categorias e regras

**Files:** Create `apps/web/src/app/painel/categorias/{page.tsx,category-tree.tsx,actions.ts}`; Modify `apps/web/src/app/painel/nav.tsx`. Test: `apps/web/e2e/categorias.spec.ts`, `e2e/a11y.spec.ts`.

- [ ] **Step 1: Write the failing e2e:** criar raiz "Casa" e filha "Reforma"; nome duplicado mostra erro no campo; renomear "Reforma" → "Obras"; arquivar "Casa" (confirmação) some com a filha; nova categoria aparece no seletor de lançamento; regra criada na Task 7 aparece em "Suas regras" e pode ser excluída; axe em `/painel/categorias` (claro e escuro).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** Árvore em `<ul>` aninhada; cada linha com nome, "Renomear" (form inline), "Nova subcategoria" (só raízes), "Arquivar". Nav ganha "Categorias".
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): manage categories and rules`

---

### Task 9: Verificação final

- [ ] **Step 1:** Capturas (script temporário no scratchpad) de `/painel/transacoes/nova` com sugestão, `/painel/transacoes`, edição com "Por que", `/painel/categorias` — 1440 e 375, claro e escuro; revisar e ajustar.
- [ ] **Step 2:** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm eval:classifier -- --check && pnpm --filter @finlens/web build && pnpm --filter @finlens/web test:e2e` — Expected: tudo PASS.
- [ ] **Step 3:** Commit de ajustes e do `docs/classifier-eval.md` atualizado; link do relatório no README.
