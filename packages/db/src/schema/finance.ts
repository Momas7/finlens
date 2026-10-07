import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

const workspaceId = () =>
  uuid()
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' });

export const financialAccounts = pgTable(
  'financial_accounts',
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    name: text().notNull(),
    type: text({ enum: ['checking', 'savings', 'cash', 'credit_card'] }).notNull(),
    institution: text(),
    openingBalanceCents: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    openingBalanceDate: date({ mode: 'string' }),
    closingDay: smallint(),
    dueDay: smallint(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Alvo das FKs compostas: FK ignora RLS, então a FK precisa incluir o workspace.
    unique('financial_accounts_workspace_id_id_key').on(t.workspaceId, t.id),
    check(
      'financial_accounts_type_check',
      sql`${t.type} in ('checking', 'savings', 'cash', 'credit_card')`,
    ),
    check(
      'financial_accounts_days_check',
      sql`(${t.closingDay} is null or ${t.closingDay} between 1 and 31) and (${t.dueDay} is null or ${t.dueDay} between 1 and 31)`,
    ),
    check(
      'financial_accounts_type_fields_check',
      sql`(${t.type} = 'credit_card' and ${t.closingDay} is not null and ${t.dueDay} is not null)
        or (${t.type} <> 'credit_card' and ${t.openingBalanceDate} is not null)`,
    ),
  ],
);

export const categories = pgTable(
  'categories',
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    parentId: uuid(),
    name: text().notNull(),
    kind: text({ enum: ['expense', 'income', 'movement'] }).notNull(),
    systemKey: text(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('categories_workspace_id_id_key').on(t.workspaceId, t.id),
    unique('categories_workspace_id_system_key_key').on(t.workspaceId, t.systemKey),
    foreignKey({
      name: 'categories_parent_fk',
      columns: [t.workspaceId, t.parentId],
      foreignColumns: [t.workspaceId, t.id],
    }),
    check('categories_kind_check', sql`${t.kind} in ('expense', 'income', 'movement')`),
  ],
);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    accountId: uuid().notNull(),
    categoryId: uuid(),
    postedDate: date({ mode: 'string' }).notNull(),
    statementMonth: date({ mode: 'string' }),
    amountCents: bigint({ mode: 'bigint' }).notNull(),
    description: text().notNull(),
    notes: text(),
    source: text({ enum: ['manual'] }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    foreignKey({
      name: 'transactions_account_fk',
      columns: [t.workspaceId, t.accountId],
      foreignColumns: [financialAccounts.workspaceId, financialAccounts.id],
    }),
    foreignKey({
      name: 'transactions_category_fk',
      columns: [t.workspaceId, t.categoryId],
      foreignColumns: [categories.workspaceId, categories.id],
    }),
    check('transactions_amount_check', sql`${t.amountCents} <> 0`),
    check('transactions_source_check', sql`${t.source} in ('manual')`),
    index('transactions_workspace_date_idx').on(t.workspaceId, t.postedDate.desc(), t.id.desc()),
    index('transactions_workspace_account_date_idx').on(t.workspaceId, t.accountId, t.postedDate),
  ],
);
