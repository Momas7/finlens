import { createHash, randomUUID } from 'node:crypto';
import type { Transaction, TransferSuggestion } from '@finlens/contracts';
import {
  categories,
  financialAccounts,
  type Tx,
  transactions,
  transferDismissals,
} from '@finlens/db';
import {
  findTransferPairs,
  type TransferAccount,
  type TransferCandidate,
  type TransferPair,
} from '@finlens/domain';
import { and, between, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { ApiError, notFound } from '../../http/errors';
import { categorize } from '../transactions/categorize';
import { toTransactionDto } from '../transactions/repository';

const WINDOW_DAYS = 12;
const MAX_SUGGESTIONS = 20;
const NEIGHBOR_DAYS = 2;

type Row = typeof transactions.$inferSelect;

export const pairId = (key: string) => createHash('sha1').update(key).digest('hex').slice(0, 16);

const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const toCandidate = (r: Row): TransferCandidate => ({
  id: r.id,
  accountId: r.accountId,
  postedDate: r.postedDate,
  amountCents: r.amountCents,
  descriptionNormalized: r.descriptionNormalized,
});

async function loadAccounts(tx: Tx) {
  return tx
    .select({
      id: financialAccounts.id,
      name: financialAccounts.name,
      type: financialAccounts.type,
    })
    .from(financialAccounts);
}

async function dismissedKeys(tx: Tx): Promise<Set<string>> {
  const rows = await tx.select({ key: transferDismissals.pairKey }).from(transferDismissals);
  return new Set(rows.map((r) => r.key));
}

/** Lançamentos que ainda podem formar um par: sem par e não confirmados. */
const open = and(
  isNull(transactions.transferPairId),
  ne(transactions.classificationStatus, 'confirmed'),
);

/** Liga os pares óbvios que incluem o lançamento recém-gravado. */
export async function autoLinkFor(tx: Tx, workspaceId: string, id: string): Promise<void> {
  const [row] = await tx.select().from(transactions).where(eq(transactions.id, id));
  if (!row || row.transferPairId || row.classificationStatus === 'confirmed') return;
  const neighbors = await tx
    .select()
    .from(transactions)
    .where(
      and(
        open,
        between(
          transactions.postedDate,
          addDays(row.postedDate, -NEIGHBOR_DAYS),
          addDays(row.postedDate, NEIGHBOR_DAYS),
        ),
        or(
          eq(transactions.amountCents, row.amountCents),
          eq(transactions.amountCents, -row.amountCents),
        ),
      ),
    );
  const { auto } = findTransferPairs({
    candidates: neighbors.map(toCandidate),
    accounts: (await loadAccounts(tx)) as TransferAccount[],
    dismissed: await dismissedKeys(tx),
  });
  for (const pair of auto) {
    if (pair.a.id === id || pair.b.id === id) await linkRows(tx, workspaceId, pair.a.id, pair.b.id);
  }
}

async function movementCategory(tx: Tx, kind: 'transfer' | 'card_payment'): Promise<string> {
  const systemKey = kind === 'transfer' ? 'movement.transfer' : 'movement.card_payment';
  const [category] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.systemKey, systemKey), isNull(categories.archivedAt)));
  if (!category) {
    throw new ApiError(409, 'conflict', 'A categoria de movimentação está indisponível.');
  }
  return category.id;
}

/** Valida e liga as duas pontas (a: saída, b: entrada). */
async function linkRows(tx: Tx, _workspaceId: string, aId: string, bId: string): Promise<void> {
  if (aId === bId) throw new ApiError(409, 'conflict', 'Escolha dois lançamentos diferentes.');
  const rows = await tx
    .select()
    .from(transactions)
    .where(inArray(transactions.id, [aId, bId]));
  const a = rows.find((r) => r.id === aId);
  const b = rows.find((r) => r.id === bId);
  if (!a || !b) throw notFound('Lançamento');
  if (a.transferPairId || b.transferPairId) {
    throw new ApiError(409, 'conflict', 'Um dos lançamentos já faz parte de uma transferência.');
  }
  if (a.accountId === b.accountId) {
    throw new ApiError(409, 'conflict', 'As duas pontas precisam estar em contas diferentes.');
  }
  if (a.amountCents + b.amountCents !== 0n) {
    throw new ApiError(409, 'conflict', 'Os valores precisam ser iguais e opostos.');
  }
  const accounts = new Map((await loadAccounts(tx)).map((x) => [x.id, x]));
  const types = [accounts.get(a.accountId)?.type, accounts.get(b.accountId)?.type];
  if (types.every((t) => t === 'credit_card')) {
    throw new ApiError(409, 'conflict', 'Dois cartões não formam uma transferência.');
  }
  const kind = types.includes('credit_card') ? 'card_payment' : 'transfer';
  const categoryId = await movementCategory(tx, kind);
  const pair = randomUUID();
  await tx
    .update(transactions)
    .set({
      transferPairId: pair,
      categoryId,
      suggestedCategoryId: null,
      classificationStatus: 'confirmed',
      classificationSource: 'user',
      classificationConfidence: 1,
      classificationExplanation: null,
    })
    .where(inArray(transactions.id, [aId, bId]));
}

export async function linkPair(tx: Tx, workspaceId: string, aId: string, bId: string) {
  // A API recebe as pontas em qualquer ordem; a saída é a de valor negativo.
  const rows = await tx
    .select({ id: transactions.id, amount: transactions.amountCents })
    .from(transactions)
    .where(inArray(transactions.id, [aId, bId]));
  const first = rows.find((r) => r.id === aId);
  if (rows.length !== 2 || !first) throw notFound('Lançamento');
  const [out, inn] = first.amount < 0n ? [aId, bId] : [bId, aId];
  await linkRows(tx, workspaceId, out, inn);
}

/** Desfaz o par e reclassifica as duas pontas em modo automático. */
export async function unlinkPair(tx: Tx, id: string): Promise<void> {
  const [row] = await tx.select().from(transactions).where(eq(transactions.id, id));
  if (!row) throw notFound('Lançamento');
  if (!row.transferPairId)
    throw new ApiError(409, 'conflict', 'Este lançamento não faz parte de uma transferência.');
  const both = await tx
    .select()
    .from(transactions)
    .where(eq(transactions.transferPairId, row.transferPairId));
  for (const r of both) {
    const { fields } = await categorize(tx, 'auto', {
      description: r.description,
      amountCents: r.amountCents,
      accountId: r.accountId,
      transactionId: r.id,
    });
    await tx
      .update(transactions)
      .set({ ...fields, transferPairId: null })
      .where(eq(transactions.id, r.id));
  }
}

/** Solta a outra ponta (as categorias ficam como estão). */
export async function releasePartner(tx: Tx, row: Row): Promise<void> {
  if (!row.transferPairId) return;
  await tx
    .update(transactions)
    .set({ transferPairId: null })
    .where(and(eq(transactions.transferPairId, row.transferPairId), ne(transactions.id, row.id)));
}

/** Pares sugeridos (e óbvios ainda sem ligação) dos últimos dias. */
export async function loadSuggestions(tx: Tx, today: string): Promise<TransferSuggestion[]> {
  const rows = await tx
    .select()
    .from(transactions)
    .where(and(open, between(transactions.postedDate, addDays(today, -WINDOW_DAYS), today)));
  if (rows.length === 0) return [];
  const accounts = await loadAccounts(tx);
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const { auto, suggested } = findTransferPairs({
    candidates: rows.map(toCandidate),
    accounts: accounts as TransferAccount[],
    dismissed: await dismissedKeys(tx),
  });
  const side = (c: TransferCandidate) => {
    const r = byId.get(c.id) as Row;
    return {
      id: r.id,
      accountName: names.get(r.accountId) ?? '',
      postedDate: r.postedDate,
      amountCents: r.amountCents.toString(),
      description: r.description,
    };
  };
  return [...auto, ...suggested]
    .sort(
      (x: TransferPair, y: TransferPair) =>
        y.a.postedDate.localeCompare(x.a.postedDate) || x.key.localeCompare(y.key),
    )
    .slice(0, MAX_SUGGESTIONS)
    .map((p) => ({
      id: pairId(p.key),
      kind: p.kind,
      reason: p.reason,
      a: side(p.a),
      b: side(p.b),
    }));
}

export async function dismissSuggestion(tx: Tx, workspaceId: string, today: string, id: string) {
  const rows = await tx
    .select()
    .from(transactions)
    .where(and(open, between(transactions.postedDate, addDays(today, -WINDOW_DAYS), today)));
  const accounts = await loadAccounts(tx);
  const { auto, suggested } = findTransferPairs({
    candidates: rows.map(toCandidate),
    accounts: accounts as TransferAccount[],
    dismissed: new Set(),
  });
  const match = [...auto, ...suggested].find((p) => pairId(p.key) === id);
  if (!match) return;
  await tx
    .insert(transferDismissals)
    .values({ workspaceId, pairKey: match.key })
    .onConflictDoNothing();
}

/** DTOs com o resumo da outra ponta (conta e tipo) nos lançamentos ligados. */
export async function withTransfers(tx: Tx, rows: Row[]): Promise<Transaction[]> {
  const pairs = [
    ...new Set(rows.map((r) => r.transferPairId).filter((p): p is string => p !== null)),
  ];
  if (pairs.length === 0) return rows.map((r) => toTransactionDto(r));
  const members = await tx
    .select({
      id: transactions.id,
      pairId: transactions.transferPairId,
      accountId: transactions.accountId,
    })
    .from(transactions)
    .where(inArray(transactions.transferPairId, pairs));
  const accounts = new Map((await loadAccounts(tx)).map((a) => [a.id, a]));
  return rows.map((r) => {
    if (!r.transferPairId) return toTransactionDto(r);
    const partner = members.find((m) => m.pairId === r.transferPairId && m.id !== r.id);
    const own = accounts.get(r.accountId);
    const other = partner ? accounts.get(partner.accountId) : undefined;
    return toTransactionDto(r, {
      pairId: r.transferPairId,
      withAccount: other?.name ?? '',
      kind:
        own?.type === 'credit_card' || other?.type === 'credit_card' ? 'card_payment' : 'transfer',
    });
  });
}
