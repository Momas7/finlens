import { randomUUID } from 'node:crypto';
import { DEFAULT_CATEGORIES } from '@finlens/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  categories,
  createDb,
  type Db,
  ensurePersonalWorkspace,
  financialAccounts,
  transactions,
  user,
  withTenant,
} from '../src';
import { createTestDatabase } from './helpers/test-db';

describe('RLS das tabelas financeiras', () => {
  let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
  let ownerDb: Db;
  let db: Db;
  const u1 = `user-${randomUUID()}`;
  const u2 = `user-${randomUUID()}`;
  let w1 = '';
  let w2 = '';
  let a1 = '';

  beforeAll(async () => {
    testDb = await createTestDatabase();
    ownerDb = createDb(testDb.ownerUrl);
    db = createDb(testDb.appUrl);
    await ownerDb.insert(user).values([
      { id: u1, name: 'Ana', email: `${u1}@example.com` },
      { id: u2, name: 'Bia', email: `${u2}@example.com` },
    ]);
    w1 = (await ensurePersonalWorkspace(db, u1)).id;
    w2 = (await ensurePersonalWorkspace(db, u2)).id;
    const [account] = await withTenant(db, { userId: u1, workspaceId: w1 }, (tx) =>
      tx
        .insert(financialAccounts)
        .values({
          workspaceId: w1,
          name: 'Inter',
          type: 'checking',
          openingBalanceCents: 0n,
          openingBalanceDate: '2026-10-01',
        })
        .returning(),
    );
    a1 = account?.id ?? '';
  });

  afterAll(async () => {
    await ownerDb?.$client.end();
    await db?.$client.end();
    await testDb?.drop();
  });

  it('sem contexto não vê contas, categorias nem transações', async () => {
    expect(await db.select().from(financialAccounts)).toHaveLength(0);
    expect(await db.select().from(categories)).toHaveLength(0);
    expect(await db.select().from(transactions)).toHaveLength(0);
  });

  it('categorias padrão semeadas uma vez', async () => {
    const rows = await withTenant(db, { userId: u1, workspaceId: w1 }, (tx) =>
      tx.select().from(categories),
    );
    expect(rows).toHaveLength(DEFAULT_CATEGORIES.length);
  });

  it('transação não referencia conta de outro workspace', async () => {
    await expect(
      withTenant(db, { userId: u2, workspaceId: w2 }, (tx) =>
        tx.insert(transactions).values({
          workspaceId: w2,
          accountId: a1,
          postedDate: '2026-10-01',
          amountCents: -100n,
          description: 'x',
          source: 'manual',
        }),
      ),
    ).rejects.toMatchObject({ cause: { message: expect.stringMatching(/foreign key/) } });
  });

  it('não grava em outro workspace', async () => {
    await expect(
      withTenant(db, { userId: u2, workspaceId: w2 }, (tx) =>
        tx.insert(financialAccounts).values({
          workspaceId: w1,
          name: 'invasor',
          type: 'cash',
          openingBalanceCents: 0n,
          openingBalanceDate: '2026-10-01',
        }),
      ),
    ).rejects.toMatchObject({ cause: { message: expect.stringMatching(/row-level security/) } });
  });

  it('outro tenant não vê a conta', async () => {
    const rows = await withTenant(db, { userId: u2, workspaceId: w2 }, (tx) =>
      tx.select().from(financialAccounts),
    );
    expect(rows).toHaveLength(0);
  });
});
