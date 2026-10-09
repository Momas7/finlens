import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createDb,
  type Db,
  ensurePersonalWorkspace,
  financialAccounts,
  goals,
  user,
  withTenant,
} from '../src';
import { createTestDatabase } from './helpers/test-db';

describe('goals', () => {
  let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
  let db: Db;
  let ownerDb: Db;
  const u1 = `user-${randomUUID()}`;
  const u2 = `user-${randomUUID()}`;
  let w1 = '';
  let w2 = '';
  let account = '';
  let first = '';
  const as1 = <T>(fn: Parameters<typeof withTenant<T>>[2]) =>
    withTenant(db, { userId: u1, workspaceId: w1 }, fn);
  const goal = (extra: Partial<typeof goals.$inferInsert> = {}) => ({
    workspaceId: w1,
    accountId: account,
    name: 'Viagem',
    targetCents: 1000000n,
    ...extra,
  });

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
    const [acc] = await as1((tx) =>
      tx
        .insert(financialAccounts)
        .values({
          workspaceId: w1,
          name: 'Reserva',
          type: 'savings',
          openingBalanceCents: 0n,
          openingBalanceDate: '2026-01-01',
        })
        .returning({ id: financialAccounts.id }),
    );
    account = acc?.id as string;
    const [g] = await as1((tx) => tx.insert(goals).values(goal()).returning({ id: goals.id }));
    first = g?.id as string;
  });
  afterAll(async () => {
    await ownerDb?.$client.end();
    await db?.$client.end();
    await testDb?.drop();
  });

  it('isolada por workspace', async () => {
    expect(await db.select().from(goals)).toHaveLength(0);
    expect(
      await withTenant(db, { userId: u2, workspaceId: w2 }, (tx) => tx.select().from(goals)),
    ).toHaveLength(0);
    expect(await as1((tx) => tx.select().from(goals))).toHaveLength(1);
  });

  it('uma meta ativa por conta; arquivada libera', async () => {
    await expect(as1((tx) => tx.insert(goals).values(goal({ name: 'Outra' })))).rejects.toThrow();
    await as1((tx) => tx.update(goals).set({ archivedAt: new Date() }).where(eq(goals.id, first)));
    await as1((tx) => tx.insert(goals).values(goal({ name: 'Nova' })));
  });

  it('valida alvo e taxa; não grava em outro workspace', async () => {
    await expect(
      as1((tx) => tx.insert(goals).values(goal({ targetCents: 0n, archivedAt: new Date() }))),
    ).rejects.toThrow();
    await expect(
      as1((tx) => tx.insert(goals).values(goal({ annualRateBp: 10001, archivedAt: new Date() }))),
    ).rejects.toThrow();
    await expect(as1((tx) => tx.insert(goals).values(goal({ workspaceId: w2 })))).rejects.toThrow();
  });
});
