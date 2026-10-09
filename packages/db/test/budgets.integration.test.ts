import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  budgets,
  categories,
  createDb,
  type Db,
  ensurePersonalWorkspace,
  user,
  withTenant,
} from '../src';
import { createTestDatabase } from './helpers/test-db';

describe('budgets', () => {
  let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
  let db: Db;
  let ownerDb: Db;
  const u1 = `user-${randomUUID()}`;
  const u2 = `user-${randomUUID()}`;
  let w1 = '';
  let w2 = '';
  let food = '';
  const as1 = <T>(fn: Parameters<typeof withTenant<T>>[2]) =>
    withTenant(db, { userId: u1, workspaceId: w1 }, fn);

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
    const [row] = await as1((tx) =>
      tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.systemKey, 'food'), isNull(categories.parentId))),
    );
    food = row?.id as string;
    await as1((tx) =>
      tx.insert(budgets).values({
        workspaceId: w1,
        categoryId: food,
        effectiveFrom: '2026-10-01',
        amountCents: 75000n,
      }),
    );
  });
  afterAll(async () => {
    await ownerDb?.$client.end();
    await db?.$client.end();
    await testDb?.drop();
  });

  it('isolada por workspace', async () => {
    expect(await db.select().from(budgets)).toHaveLength(0);
    expect(
      await withTenant(db, { userId: u2, workspaceId: w2 }, (tx) => tx.select().from(budgets)),
    ).toHaveLength(0);
    expect(await as1((tx) => tx.select().from(budgets))).toHaveLength(1);
  });

  it('não grava em outro workspace', async () => {
    await expect(
      as1((tx) =>
        tx.insert(budgets).values({
          workspaceId: w2,
          categoryId: food,
          effectiveFrom: '2026-11-01',
          amountCents: 1n,
        }),
      ),
    ).rejects.toThrow();
  });

  it('início sempre no dia 1 e valor positivo ou nulo', async () => {
    await expect(
      as1((tx) =>
        tx.insert(budgets).values({
          workspaceId: w1,
          categoryId: food,
          effectiveFrom: '2026-12-15',
          amountCents: 1n,
        }),
      ),
    ).rejects.toThrow();
    await expect(
      as1((tx) =>
        tx.insert(budgets).values({
          workspaceId: w1,
          categoryId: food,
          effectiveFrom: '2026-12-01',
          amountCents: 0n,
        }),
      ),
    ).rejects.toThrow();
    await as1((tx) =>
      tx.insert(budgets).values({
        workspaceId: w1,
        categoryId: food,
        effectiveFrom: '2027-01-01',
        amountCents: null,
      }),
    );
  });

  it('uma versão por categoria e mês', async () => {
    await expect(
      as1((tx) =>
        tx.insert(budgets).values({
          workspaceId: w1,
          categoryId: food,
          effectiveFrom: '2026-10-01',
          amountCents: 9n,
        }),
      ),
    ).rejects.toThrow();
  });
});
