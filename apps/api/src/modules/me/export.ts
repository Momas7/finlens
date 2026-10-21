import {
  auditLogs,
  budgets,
  categories,
  classificationFeedback,
  classificationRules,
  financialAccounts,
  goals,
  insightStates,
  ruleSuggestionDismissals,
  type Tx,
  transactions,
  transferDismissals,
} from '@finlens/db';
import { type CsvTransaction, transactionsCsv } from '@finlens/domain';
import { asc } from 'drizzle-orm';

/** Linha pronta para JSON: sem `workspaceId`, bigint como string e datas em ISO. */
function serialize(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'workspaceId') continue;
    out[key] =
      typeof value === 'bigint'
        ? value.toString()
        : value instanceof Date
          ? value.toISOString()
          : value;
  }
  return out;
}

const all = (rows: Record<string, unknown>[]) => rows.map(serialize);

/** Todos os dados do workspace (lidos sob RLS). Nada de autenticação entra aqui. */
export async function exportData(
  tx: Tx,
  profile: { name: string; email: string },
  workspaceName: string,
) {
  const [
    accountRows,
    categoryRows,
    transactionRows,
    ruleRows,
    dismissalRows,
    feedbackRows,
    budgetRows,
    goalRows,
    insightRows,
    transferDismissalRows,
    auditRows,
  ] = await Promise.all([
    tx.select().from(financialAccounts).orderBy(asc(financialAccounts.createdAt)),
    tx.select().from(categories),
    tx.select().from(transactions).orderBy(asc(transactions.postedDate), asc(transactions.id)),
    tx.select().from(classificationRules),
    tx.select().from(ruleSuggestionDismissals),
    tx.select().from(classificationFeedback),
    tx.select().from(budgets),
    tx.select().from(goals),
    tx.select().from(insightStates),
    tx.select().from(transferDismissals),
    tx.select().from(auditLogs).orderBy(asc(auditLogs.createdAt)),
  ]);
  return {
    format: 'finlens-export/1',
    exportedAt: new Date().toISOString(),
    user: { name: profile.name, email: profile.email },
    workspace: { name: workspaceName },
    accounts: all(accountRows),
    categories: all(categoryRows),
    transactions: all(transactionRows),
    classificationRules: all(ruleRows),
    ruleSuggestionDismissals: all(dismissalRows),
    classificationFeedback: all(feedbackRows),
    budgets: all(budgetRows),
    goals: all(goalRows),
    insightStates: all(insightRows),
    transferDismissals: all(transferDismissalRows),
    auditLogs: all(auditRows.map(({ userId: _userId, ...rest }) => rest)),
  };
}

/** CSV de lançamentos com nome da conta e categoria "Raiz › Filha". */
export async function exportCsv(tx: Tx): Promise<string> {
  const [accountRows, categoryRows, rows] = await Promise.all([
    tx.select({ id: financialAccounts.id, name: financialAccounts.name }).from(financialAccounts),
    tx
      .select({ id: categories.id, name: categories.name, parentId: categories.parentId })
      .from(categories),
    tx.select().from(transactions).orderBy(asc(transactions.postedDate), asc(transactions.id)),
  ]);
  const accountName = new Map(accountRows.map((a) => [a.id, a.name]));
  const byId = new Map(categoryRows.map((c) => [c.id, c]));
  const label = (id: string | null) => {
    const c = id ? byId.get(id) : undefined;
    if (!c) return null;
    const parent = c.parentId ? byId.get(c.parentId) : undefined;
    return parent ? `${parent.name} › ${c.name}` : c.name;
  };
  const csvRows: CsvTransaction[] = rows.map((r) => ({
    postedDate: r.postedDate,
    account: accountName.get(r.accountId) ?? '',
    description: r.description,
    amountCents: r.amountCents,
    category: label(r.categoryId),
    status: r.classificationStatus,
  }));
  return transactionsCsv(csvRows);
}
