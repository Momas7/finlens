# F1b — Importação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar fatura Inter (CSV), OFX e CSV mapeado com prévia, deduplicação e classificação normal.

**Architecture:** Parsers puros no domínio; lote de importação em tabela com linhas em jsonb; commit atômico reutilizando `categorize` e `autoLinkFor`; página `/painel/importar` com Server Actions.

**Tech Stack:** TypeScript, Drizzle/Postgres RLS, Fastify, Next.js 16, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-f1b-importacao-design.md`

## Global Constraints

- Nunca commitar nem ler `fixtures/private/` em testes; fixtures sintéticas inventadas.
- Dinheiro em centavos (bigint no domínio, string na API); saída negativa.
- Sem `Co-Authored-By` nem rodapé de ferramenta.
- Arquivo bruto nunca é guardado; só as linhas lidas.

## Review Focus

1. Chave de dedup estável entre importações com períodos sobrepostos e com duas linhas idênticas no mesmo dia. — Task 3.
2. Commit duas vezes ao mesmo tempo (duplo clique) não duplica lançamentos (UNIQUE + status do lote). — Task 3.
3. Arquivo em Windows-1252 e com BOM não vira lixo. — Task 1/4.
4. Prévia não grava lançamentos nem vaza entre workspaces. — Task 3.
5. Pagamento de fatura negativo no CSV do Inter vira entrada e liga com a conta quando há par. — Task 3.

---

### Task 1: Domínio — parsers
**Files:** Create `packages/domain/src/import/{money.ts,csv.ts,inter.ts,ofx.ts,generic.ts,index.ts}` + `*.test.ts`; Modify `packages/domain/src/index.ts`.
**Produces:** `parseBrMoney(text): bigint | null`; `parseCsv(text): string[][]` (remove BOM, detecta `;`/`,`/tab, aspas); `ImportRow = { postedDate: string; description: string; amountCents: bigint; externalId: string | null }`; `ColumnMapping = { date: number; description: number; amount: number; dateFormat: 'dd/MM/yyyy'|'yyyy-MM-dd'|'MM/dd/yyyy'; decimal: 'comma'|'dot'; expenseSign: 'negative'|'positive' }`; `parseImport(text, mapping?): { kind: 'rows'; format: 'ofx'|'csv'; rows: ImportRow[]; ignored: number } | { kind: 'needs_mapping'; headers: string[]; sample: string[][] } | { kind: 'error'; message: string }`.
- [ ] Testes (RED): `parseBrMoney('R$ 1.267,64')=126764n`, `'-R$ 217,50'=-21750n`, `'abc'=null`; CSV com BOM, aspas e vírgula dentro; preset Inter: `"20/10/2026","MIX MATEUS","COMPRAS","Parcela 1/2","R$ 64,38"` → `{2026-10-20, 'MIX MATEUS PARC 01/02', -6438n}`, pagamento `-R$ 217,50` → `+21750n`, Categoria ignorada, linha com data inválida ignorada (contagem em `ignored`); OFX com FITID, `TRNAMT -45.90` e `-45,90`, NAME+MEMO, DTPOSTED `20261005120000[-3:BRT]`; CSV genérico com mapeamento (`positive` = gasto positivo vira negativo); cabeçalho desconhecido sem mapeamento → `needs_mapping`; texto vazio/sem linhas → `error`.
- [ ] RED → implementar → GREEN → `git commit -m "feat(domain): statement parsers"`

### Task 2: Banco e contratos
**Files:** Modify `packages/db/src/schema/finance.ts` (`importBatches`, `transactions.importKey`, source `import`, índice único parcial); Create migration gerada (`pnpm --filter @finlens/db db:generate`) e `0018_import_batches_rls.sql` (RLS ENABLE+FORCE+política, padrão da 0017; atualizar `meta/_journal.json` como as anteriores); Create `packages/contracts/src/imports.ts` (+ index); Modify `contracts/src/transactions.ts` (`source: z.enum(['manual','import'])`).
**Produces:** `ImportPreviewRequest { accountId, filename, content, mapping? }`, `ImportPreview`, `ImportCommitResult`, `ImportMapping` (zod espelhando `ColumnMapping`).
- [ ] Teste: `rls-coverage` continua verde com a tabela nova (rodar `pnpm --filter @finlens/db test:integration`).
- [ ] `git commit -m "feat(db): import batches and import key"`

### Task 3: API
**Files:** Create `apps/api/src/modules/imports/{routes.ts,service.ts}`, `apps/api/test/imports.integration.test.ts`; Modify `app.ts`.
- [ ] Testes (RED): prévia não grava transações; summary e status por linha; commit grava com `source: 'import'`, classificação aplicada, mês da fatura em cartão; arquivo repetido → 409 na prévia; reimportar com sobreposição só traz novas; duas linhas idênticas no mesmo dia viram dois lançamentos e continuam sem duplicar numa segunda importação; manual com mesma conta/data/valor → `existing`; commit duplo simultâneo → um grava, outro 409; lote de outro workspace → 404; conta arquivada → 409; `needsMapping` para CSV desconhecido; pagamento negativo do cartão liga a par da conta corrente quando há saída igual.
- [ ] RED → implementar (`sha256` em `node:crypto`; chave = FITID ou data|valor|desc normalizada|ordem; lock otimista: `update import_batches set status='committed' where id=$1 and status='preview'` antes de inserir; rota com `bodyLimit` de 5 MB) → GREEN → `git commit -m "feat(api): statement import preview and commit"`

### Task 4: Web
**Files:** Create `apps/web/src/app/painel/importar/{page.tsx,import-form.tsx,preview.tsx,mapping-form.tsx,actions.ts}`, `apps/web/src/lib/decode.ts` (+ teste), `apps/web/e2e/importar.spec.ts`, `apps/web/e2e/fixtures/fatura-inter.csv` (sintético); Modify cabeçalho de `transacoes/page.tsx` (link "Importar"), `a11y.spec.ts`.
- [ ] Teste unitário `decode`: UTF-8 com BOM, Windows-1252 (`ç` = 0xE7), UTF-8 inválido cai para Windows-1252.
- [ ] E2E: criar cartão (fechamento 5, vencimento 12), enviar fatura sintética, ver resumo e lista, importar, cair na Revisão com "lançamentos importados"; segundo envio do mesmo arquivo → "Este arquivo já foi importado."; CSV desconhecido → formulário de mapeamento → prévia; axe na prévia e no mapeamento (claro e escuro).
- [ ] RED → implementar → GREEN → `git commit -m "feat(web): statement import page"`

### Task 5: Verificação final
- [ ] README (seção "Importação", roadmap F1b ✅, números dos testes), `docs/architecture.md` (pipeline: síncrono, sem worker); suíte completa PASS; remover a memória `f1b-aguarda-extratos` e registrar que faltam presets Mercado Pago/extrato Inter.
