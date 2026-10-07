import type { Account, AccountCreate, AccountUpdate } from '@finlens/contracts';
import { financialAccounts, type Tx, transactions } from '@finlens/db';
import { statementMonth, todayInSaoPaulo } from '@finlens/domain';
import { and, eq, isNull, sql } from 'drizzle-orm';

type AccountRow = typeof financialAccounts.$inferSelect;

function toDto(row: AccountRow, movedCents: bigint, invoiceByMonth: Map<string, bigint>): Account {
  const isCard = row.type === 'credit_card';
  const month = isCard ? statementMonth(todayInSaoPaulo(), row.closingDay ?? 31) : null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    institution: row.institution,
    openingBalanceCents: row.openingBalanceCents.toString(),
    openingBalanceDate: row.openingBalanceDate,
    closingDay: row.closingDay,
    dueDay: row.dueDay,
    balanceCents: isCard ? null : (row.openingBalanceCents + movedCents).toString(),
    openInvoiceCents: month ? (-(invoiceByMonth.get(month) ?? 0n)).toString() : null,
    currentStatementMonth: month,
    archived: row.archivedAt !== null,
  };
}

async function enrich(tx: Tx, rows: AccountRow[]): Promise<Account[]> {
  if (rows.length === 0) return [];
  // Movimento desde o saldo inicial (contas) e soma por mês de fatura (cartões).
  const moved = await tx
    .select({
      accountId: transactions.accountId,
      cents: sql<string>`coalesce(sum(${transactions.amountCents}) filter (where ${transactions.postedDate} >= ${financialAccounts.openingBalanceDate}), 0)`,
    })
    .from(transactions)
    .innerJoin(financialAccounts, eq(financialAccounts.id, transactions.accountId))
    .groupBy(transactions.accountId);
  const invoices = await tx
    .select({
      accountId: transactions.accountId,
      month: transactions.statementMonth,
      cents: sql<string>`sum(${transactions.amountCents})`,
    })
    .from(transactions)
    .where(sql`${transactions.statementMonth} is not null`)
    .groupBy(transactions.accountId, transactions.statementMonth);

  const movedBy = new Map(moved.map((m) => [m.accountId, BigInt(m.cents)]));
  return rows.map((row) => {
    const byMonth = new Map(
      invoices
        .filter((i) => i.accountId === row.id && i.month)
        .map((i) => [i.month as string, BigInt(i.cents)]),
    );
    return toDto(row, movedBy.get(row.id) ?? 0n, byMonth);
  });
}

export async function listAccounts(tx: Tx, includeArchived = false): Promise<Account[]> {
  const rows = await tx
    .select()
    .from(financialAccounts)
    .where(includeArchived ? undefined : isNull(financialAccounts.archivedAt))
    .orderBy(financialAccounts.createdAt);
  return enrich(tx, rows);
}

export async function findActiveAccount(tx: Tx, id: string): Promise<AccountRow | undefined> {
  const [row] = await tx
    .select()
    .from(financialAccounts)
    .where(and(eq(financialAccounts.id, id), isNull(financialAccounts.archivedAt)));
  return row;
}

/** Conta do workspace, arquivada ou não. */
export async function findAccount(tx: Tx, id: string): Promise<AccountRow | undefined> {
  const [row] = await tx.select().from(financialAccounts).where(eq(financialAccounts.id, id));
  return row;
}

export async function getAccount(tx: Tx, id: string): Promise<Account | undefined> {
  const row = await findActiveAccount(tx, id);
  return row ? (await enrich(tx, [row]))[0] : undefined;
}

export async function createAccount(tx: Tx, workspaceId: string, input: AccountCreate) {
  const values =
    input.type === 'credit_card'
      ? { closingDay: input.closingDay, dueDay: input.dueDay, openingBalanceCents: 0n }
      : {
          openingBalanceCents: BigInt(input.openingBalanceCents),
          openingBalanceDate: input.openingBalanceDate,
        };
  const [row] = await tx
    .insert(financialAccounts)
    .values({
      workspaceId,
      name: input.name,
      type: input.type,
      institution: input.institution ?? null,
      ...values,
    })
    .returning({ id: financialAccounts.id });
  return row?.id as string;
}

export async function updateAccount(tx: Tx, row: AccountRow, input: AccountUpdate) {
  await tx
    .update(financialAccounts)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.institution !== undefined && { institution: input.institution }),
      ...(input.openingBalanceCents !== undefined && {
        openingBalanceCents: BigInt(input.openingBalanceCents),
      }),
      ...(input.openingBalanceDate !== undefined && {
        openingBalanceDate: input.openingBalanceDate,
      }),
      ...(input.closingDay !== undefined && { closingDay: input.closingDay }),
      ...(input.dueDay !== undefined && { dueDay: input.dueDay }),
    })
    .where(eq(financialAccounts.id, row.id));

  if (input.closingDay !== undefined && input.closingDay !== row.closingDay) {
    // Mesma regra de statementMonth() (packages/domain), em SQL para atualizar tudo de uma vez.
    await tx.execute(sql`
      update ${transactions}
      set statement_month = case
        when extract(day from posted_date) > least(${input.closingDay}, extract(day from (date_trunc('month', posted_date) + interval '1 month - 1 day')))
          then (date_trunc('month', posted_date) + interval '1 month')::date
        else date_trunc('month', posted_date)::date
      end
      where account_id = ${row.id}`);
  }
}

export async function archiveAccount(tx: Tx, id: string) {
  await tx
    .update(financialAccounts)
    .set({ archivedAt: new Date() })
    .where(eq(financialAccounts.id, id));
}
