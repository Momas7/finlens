# F3a — Transferências e fatura Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar as duas pontas de transferências e pagamentos de fatura (automático quando óbvio, sugestão na Revisão), tirando-as de gasto e receita.

**Architecture:** Detecção pura em `packages/domain/src/transfers`; coluna `transfer_pair_id` + tabela de recusas; módulo `transfers` na API chamado após criar/editar lançamentos; seção nova na Revisão e selos na lista.

**Tech Stack:** TypeScript, Drizzle/Postgres RLS, Fastify, Next.js 16, Vitest, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-15-f3a-transferencias-design.md`

## Global Constraints

- Regras e limiares da spec (valores absolutos iguais, contas diferentes, ±2 dias para sugerir, ≤ 1 dia + menção + unicidade para ligar, lado do cartão positivo, dois cartões não formam par).
- Confirmados e já ligados nunca entram na detecção.
- RLS ENABLE+FORCE na tabela nova, em migração própria.
- Sem `Co-Authored-By` nem rodapé de ferramenta.

## Review Focus

1. **Três lançamentos de mesmo valor** (ex.: duas saídas e uma entrada): ambíguo, nunca liga sozinho. — Task 1 e 3.
2. **Editar valor de lançamento ligado**: desfaz o par, sem deixar a outra ponta órfã com o id. — Task 3.
3. **Excluir uma ponta**: limpa o par da outra. — Task 3.
4. **Pagamento de fatura com cartão como lado negativo** (compra de mesmo valor que uma saída): não forma par. — Task 1.
5. **Usuário sem cartão ou com uma conta só**: sugestões vazias, sem erro. — Task 3.

---

### Task 1: Domínio — detecção de pares

**Files:** Create `packages/domain/src/transfers/{pairs.ts,pairs.test.ts,index.ts}`; Modify `packages/domain/src/index.ts`.

**Produces:** `type TransferCandidate = { id; accountId; postedDate; amountCents: bigint; descriptionNormalized: string }`; `type TransferAccount = { id; name; type: 'checking'|'savings'|'cash'|'credit_card' }`; `type TransferPair = { a: TransferCandidate; b: TransferCandidate; kind: 'transfer'|'card_payment'; reason: string; key: string }` (`key = idMenor:idMaior`); `findTransferPairs(input: { candidates; accounts; dismissed: Set<string> }): { auto: TransferPair[]; suggested: TransferPair[] }`; `normalizeAccountName(name)`.

- [ ] **Step 1: Testes que falham** (candidatos montados à mão): auto com PIX, 1 dia; sugerido sem menção; sugerido com 2 dias; ambíguo (2 saídas iguais) → ambos sugeridos, nenhum auto; mesma conta → nada; 1 centavo de diferença → nada; cartão como lado negativo → nada; dois cartões → nada; fatura (corrente −, cartão +, "PAGAMENTO FATURA") → `card_payment` auto; nome da outra conta no texto conta como menção; dispensado ignorado; razão com datas `dd/mm` e "com PIX no texto".
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** `git commit -m "feat(domain): transfer pair detection"`

---

### Task 2: Banco

**Files:** Modify `packages/db/src/schema/finance.ts`; migrations `0016_*` (gerada) + `0017_transfer_dismissals_rls.sql`; Create `packages/db/test/transfers.integration.test.ts`.

**Produces:** `transactions.transferPairId (uuid, nulo)`, índice parcial; `transferDismissals (id, workspaceId, pairKey, createdAt)` única por `(workspaceId, pairKey)`.

- [ ] Teste: isolamento de `transfer_dismissals`; não grava em outro workspace; chave repetida falha. RED → schema + migrações → GREEN (+ `rls-coverage`) → `db:migrate` no dev.
- [ ] `git commit -m "feat(db): transfer pairs and dismissals"`

---

### Task 3: API

**Files:** Create `apps/api/src/modules/transfers/{queries,routes}.ts`, `apps/api/test/transfers.integration.test.ts`; Modify `packages/contracts/src/{transactions,review}.ts` (+ `transfers.ts`), `apps/api/src/modules/transactions/{routes,repository}.ts`, `apps/api/src/modules/review/{queries,routes}.ts`, `apps/api/src/app.ts`, testes que comparam `counts`.

**Interfaces:**
- Contratos: `TransferSuggestion`, `TransferSuggestionList`, `TransferLink { a, b }`, `TransferDismiss { id }`; `Transaction.transfer: { pairId, withAccount, kind } | null`; `Review.counts.transfers`.
- `transfers/queries.ts`: `autoLinkFor(tx, workspaceId, transactionId)`, `linkPair(tx, workspaceId, aId, bId)` (valida e liga), `unlinkPair(tx, transactionId)`, `loadSuggestions(tx, today)`, `withTransfers(tx, rows)` (anexa `transfer` ao DTO), `pairIdOf(key)`.
- Categoria de destino: `categories.systemKey` `movement.transfer` / `movement.card_payment`, ativa; ausente → 409.

- [ ] **Step 1: Testes que falham** (`createTestApp({ AUTH_RATE_LIMIT_PER_MINUTE: '100' })`): duas contas (corrente e poupança); saída −50000 "PIX RESERVA" e entrada +50000 "PIX RECEBIDO INTER" em dias seguidos (categoria `auto`) → ambas com `transfer.withAccount` e categoria de movimentação, e os totais de `/v1/analytics/month` sem elas; ambíguo (duas saídas iguais + uma entrada) → nenhuma ligada, `suggestions` com pares; link → 204 e some das sugestões; dismiss → some para sempre; unlink → `transfer: null` nos dois e status `auto`; editar valor de ligada desfaz o par; excluir uma ponta limpa a outra; fatura com cartão; 409 (mesma conta, valores diferentes, já com par), 404 (alheio), isolamento; usuário sem contas → `[]`; `/v1/review` traz `counts.transfers`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** `pnpm --filter @finlens/api test:integration` PASS.
- [ ] **Step 5:** `git commit -m "feat(api): link transfers and card payments"`

---

### Task 4: Web

**Files:** Create `apps/web/src/app/painel/revisao/transfer-suggestions.tsx`, `apps/web/src/app/painel/transacoes/[id]/unlink-button.tsx`, `apps/web/e2e/transferencias.spec.ts`; Modify `revisao/{page,actions}`, `transacoes/page.tsx`, `transacoes/[id]/page.tsx`, `painel/layout.tsx` (contador), `e2e/a11y.spec.ts`.

- [ ] Testes E2E: transferência vira selo "Transferência com …" nas duas pontas e "Sobrou" não muda; sugestão ambígua na Revisão com contador, "É transferência" liga, "Não é" some e não volta após recarregar; "Desfazer transferência"; a11y da Revisão com pares.
- [ ] RED → implementar → GREEN (`pnpm --filter @finlens/web test:e2e transferencias.spec.ts revisao.spec.ts a11y.spec.ts`).
- [ ] `git commit -m "feat(web): transfer suggestions and badges"`

---

### Task 5: Demo, docs e verificação final

- [ ] Plano demo: transferências para a Reserva em modo automático com "PIX TRANSF RESERVA" (ajustar teste do gerador e a regra); teste de integração da demo confere as pontas ligadas.
- [ ] README: roadmap F3a ✅.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm eval:classifier --check && pnpm --filter @finlens/web build && pnpm --filter @finlens/web test:e2e` PASS.
