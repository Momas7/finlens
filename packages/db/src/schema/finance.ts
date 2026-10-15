import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
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
    // Nome único entre irmãs ativas, sem diferenciar maiúsculas (raízes têm parent_id nulo).
    uniqueIndex('categories_sibling_name_idx')
      .on(
        t.workspaceId,
        sql`coalesce(${t.parentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        sql`lower(${t.name})`,
      )
      .where(sql`${t.archivedAt} is null`),
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
    descriptionNormalized: text().notNull().default(''),
    merchantKey: text(),
    classificationStatus: text({ enum: ['auto', 'likely', 'suggested', 'confirmed', 'none'] })
      .notNull()
      .default('none'),
    classificationSource: text({
      enum: ['rule', 'history', 'similar', 'merchant', 'keyword', 'user'],
    }),
    classificationConfidence: numeric({ precision: 4, scale: 3, mode: 'number' }),
    classificationExplanation: text(),
    suggestedCategoryId: uuid(),
    /** Mesmo id nas duas pontas de uma transferência ou pagamento de fatura. */
    transferPairId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('transactions_workspace_pair_idx')
      .on(t.workspaceId, t.transferPairId)
      .where(sql`${t.transferPairId} is not null`),
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
    foreignKey({
      name: 'transactions_suggested_category_fk',
      columns: [t.workspaceId, t.suggestedCategoryId],
      foreignColumns: [categories.workspaceId, categories.id],
    }),
    unique('transactions_workspace_id_id_key').on(t.workspaceId, t.id),
    check(
      'transactions_classification_status_check',
      sql`${t.classificationStatus} in ('auto', 'likely', 'suggested', 'confirmed', 'none')`,
    ),
    check(
      'transactions_classification_source_check',
      sql`${t.classificationSource} is null or ${t.classificationSource} in ('rule', 'history', 'similar', 'merchant', 'keyword', 'user')`,
    ),
    index('transactions_description_trgm_idx').using(
      'gin',
      sql`${t.descriptionNormalized} gin_trgm_ops`,
    ),
    index('transactions_workspace_merchant_idx').on(t.workspaceId, t.merchantKey),
    check('transactions_amount_check', sql`${t.amountCents} <> 0`),
    check('transactions_source_check', sql`${t.source} in ('manual')`),
    index('transactions_workspace_date_idx').on(t.workspaceId, t.postedDate.desc(), t.id.desc()),
    index('transactions_workspace_account_date_idx').on(t.workspaceId, t.accountId, t.postedDate),
  ],
);

export const classificationRules = pgTable(
  'classification_rules',
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    categoryId: uuid().notNull(),
    /** Texto normalizado procurado na descrição normalizada (ou chave de estabelecimento). */
    pattern: text().notNull(),
    minAmountCents: bigint({ mode: 'bigint' }),
    maxAmountCents: bigint({ mode: 'bigint' }),
    accountId: uuid(),
    priority: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: 'classification_rules_category_fk',
      columns: [t.workspaceId, t.categoryId],
      foreignColumns: [categories.workspaceId, categories.id],
    }),
    foreignKey({
      name: 'classification_rules_account_fk',
      columns: [t.workspaceId, t.accountId],
      foreignColumns: [financialAccounts.workspaceId, financialAccounts.id],
    }),
  ],
);

/** Cada decisão do usuário, com o que o motor tinha previsto naquele momento. */
export const classificationFeedback = pgTable(
  'classification_feedback',
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    // FK composta com ON DELETE SET NULL (transaction_id) criada na migration custom.
    transactionId: uuid(),
    predictedCategoryId: uuid(),
    predictedConfidence: numeric({ precision: 4, scale: 3, mode: 'number' }),
    predictedSource: text(),
    chosenCategoryId: uuid(),
    merchantKey: text(),
    descriptionNormalized: text().notNull(),
    amountBucket: text({ enum: ['xs', 'sm', 'md', 'lg'] }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: 'classification_feedback_predicted_fk',
      columns: [t.workspaceId, t.predictedCategoryId],
      foreignColumns: [categories.workspaceId, categories.id],
    }),
    foreignKey({
      name: 'classification_feedback_chosen_fk',
      columns: [t.workspaceId, t.chosenCategoryId],
      foreignColumns: [categories.workspaceId, categories.id],
    }),
    index('classification_feedback_workspace_idx').on(t.workspaceId, t.createdAt),
  ],
);

/** Sugestões de regra que o usuário dispensou; não voltam a ser propostas. */
export const ruleSuggestionDismissals = pgTable(
  'rule_suggestion_dismissals',
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    suggestionId: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('rule_suggestion_dismissals_workspace_suggestion_key').on(t.workspaceId, t.suggestionId),
  ],
);

/**
 * Orçamento mensal por categoria principal, versionado por mês: o limite de um mês é a versão
 * mais recente com início até ele. `amountCents` nulo = sem orçamento a partir daquele mês.
 */
export const budgets = pgTable(
  'budgets',
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    categoryId: uuid().notNull(),
    effectiveFrom: date({ mode: 'string' }).notNull(),
    amountCents: bigint({ mode: 'bigint' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    foreignKey({
      name: 'budgets_category_fk',
      columns: [t.workspaceId, t.categoryId],
      foreignColumns: [categories.workspaceId, categories.id],
    }),
    unique('budgets_workspace_category_month_key').on(t.workspaceId, t.categoryId, t.effectiveFrom),
    check('budgets_month_start_check', sql`extract(day from ${t.effectiveFrom}) = 1`),
    check('budgets_amount_check', sql`${t.amountCents} is null or ${t.amountCents} > 0`),
  ],
);

/** Estado de cada insight já servido: quando apareceu pela primeira vez e se foi dispensado. */
export const insightStates = pgTable(
  'insight_states',
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    dedupeKey: text().notNull(),
    firstSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    dismissedAt: timestamp({ withTimezone: true }),
  },
  (t) => [unique('insight_states_workspace_key').on(t.workspaceId, t.dedupeKey)],
);

/** Meta de dinheiro guardado: o progresso é o saldo da conta vinculada. */
export const goals = pgTable(
  'goals',
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    accountId: uuid().notNull(),
    name: text().notNull(),
    targetCents: bigint({ mode: 'bigint' }).notNull(),
    targetDate: date({ mode: 'string' }),
    /** Rendimento anual em pontos-base (10,5% = 1050); nulo = sem rendimento. */
    annualRateBp: integer(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    foreignKey({
      name: 'goals_account_fk',
      columns: [t.workspaceId, t.accountId],
      foreignColumns: [financialAccounts.workspaceId, financialAccounts.id],
    }),
    // Uma meta ativa por conta: o mesmo saldo não pode contar duas vezes.
    uniqueIndex('goals_active_account_idx')
      .on(t.workspaceId, t.accountId)
      .where(sql`${t.archivedAt} is null`),
    check('goals_target_check', sql`${t.targetCents} > 0`),
    check(
      'goals_rate_check',
      sql`${t.annualRateBp} is null or (${t.annualRateBp} >= 0 and ${t.annualRateBp} <= 10000)`,
    ),
    check('goals_name_check', sql`char_length(${t.name}) between 1 and 60`),
  ],
);

/** Pares de lançamentos que a pessoa disse que não são transferência; não voltam a ser sugeridos. */
export const transferDismissals = pgTable(
  'transfer_dismissals',
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    pairKey: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('transfer_dismissals_workspace_pair_key').on(t.workspaceId, t.pairKey)],
);
