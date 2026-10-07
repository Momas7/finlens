import { sql } from 'drizzle-orm';
import { check, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const workspaces = pgTable('workspaces', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  // Preenchido apenas no workspace pessoal; garante no máximo um por usuário.
  personalOwnerId: text()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text({ enum: ['owner', 'member'] }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    check('workspace_members_role_check', sql`${t.role} in ('owner', 'member')`),
  ],
);
