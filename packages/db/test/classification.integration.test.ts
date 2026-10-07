import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  categories,
  classificationFeedback,
  classificationRules,
  createDb,
  type Db,
  ensurePersonalWorkspace,
  financialAccounts,
  transactions,
  user,
  withTenant,
} from '../src';
import { createTestDatabase } from './helpers/test-db';

describe('tabelas de classificação', () => {
  let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
  let ownerDb: Db;
  let db: Db;
  const u1 = `user-${randomUUID()}`;
  const u2 = `user-${randomUUID()}`;
  let w1 = '';
  let w2 = '';
  let account = '';
  let category1 = '';
  let category2 = '';
  const as1 = <T>(fn: Parameters<typeof withTenant<T>>[2]) =>
    withTenant(db, { userId: u1, workspaceId: w1 }, fn);
  const as2 = <T>(fn: Parameters<typeof withTenant<T>>[2]) =>
    withTenant(db, { userId: u2, workspaceId: w2 }, fn);

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
    account =
      (
        await as1((tx) =>
          tx
            .insert(financialAccounts)
            .values({
              workspaceId: w1,
              name: 'Inter',
              type: 'checking',
              openingBalanceDate: '2026-10-01',
            })
            .returning(),
        )
      )[0]?.id ?? '';
    category1 =
      (await as1((tx) => tx.select().from(categories).where(isNull(categories.parentId))))[0]?.id ??
      '';
    category2 =
      (await as2((tx) => tx.select().from(categories).where(isNull(categories.parentId))))[0]?.id ??
      '';
  });
  afterAll(async () => {
    await ownerDb?.$client.end();
    await db?.$client.end();
    await testDb?.drop();
  });

  it('transação nova recebe defaults de classificação', async () => {
    const [row] = await as1((tx) =>
      tx
        .insert(transactions)
        .values({
          workspaceId: w1,
          accountId: account,
          postedDate: '2026-10-02',
          amountCents: -100n,
          description: 'x',
          source: 'manual',
        })
        .returning(),
    );
    expect(row).toMatchObject({
      descriptionNormalized: '',
      classificationStatus: 'none',
      classificationSource: null,
    });
  });

  it('RLS: regras e feedback isolados por workspace', async () => {
    await as1((tx) =>
      tx
        .insert(classificationRules)
        .values({ workspaceId: w1, categoryId: category1, pattern: 'PADARIA' }),
    );
    await as1((tx) =>
      tx.insert(classificationFeedback).values({
        workspaceId: w1,
        chosenCategoryId: category1,
        descriptionNormalized: 'PADARIA',
        amountBucket: 'xs',
      }),
    );
    expect(await db.select().from(classificationRules)).toHaveLength(0);
    expect(await as2((tx) => tx.select().from(classificationRules))).toHaveLength(0);
    expect(await as2((tx) => tx.select().from(classificationFeedback))).toHaveLength(0);
    expect(await as1((tx) => tx.select().from(classificationRules))).toHaveLength(1);
  });

  it('regra não aponta para categoria de outro workspace', async () => {
    await expect(
      as1((tx) =>
        tx
          .insert(classificationRules)
          .values({ workspaceId: w1, categoryId: category2, pattern: 'X' }),
      ),
    ).rejects.toMatchObject({ cause: { message: expect.stringMatching(/foreign key/) } });
  });

  it('apagar transação mantém o feedback sem vínculo', async () => {
    const [t] = await as1((tx) =>
      tx
        .insert(transactions)
        .values({
          workspaceId: w1,
          accountId: account,
          postedDate: '2026-10-02',
          amountCents: -100n,
          description: 'y',
          source: 'manual',
        })
        .returning(),
    );
    const [f] = await as1((tx) =>
      tx
        .insert(classificationFeedback)
        .values({
          workspaceId: w1,
          transactionId: t?.id,
          chosenCategoryId: category1,
          descriptionNormalized: 'Y',
          amountBucket: 'xs',
        })
        .returning(),
    );
    await as1((tx) => tx.delete(transactions).where(eq(transactions.id, t?.id ?? '')));
    const [after] = await as1((tx) =>
      tx
        .select()
        .from(classificationFeedback)
        .where(eq(classificationFeedback.id, f?.id ?? '')),
    );
    expect(after?.transactionId).toBeNull();
  });

  it('nome de categoria único entre irmãs ativas', async () => {
    await as1((tx) =>
      tx.insert(categories).values({ workspaceId: w1, name: 'Casa', kind: 'expense' }),
    );
    await expect(
      as1((tx) => tx.insert(categories).values({ workspaceId: w1, name: 'casa', kind: 'expense' })),
    ).rejects.toMatchObject({ cause: { message: expect.stringMatching(/unique|duplicate/) } });
    await as1((tx) =>
      tx.update(categories).set({ archivedAt: new Date() }).where(eq(categories.name, 'Casa')),
    );
    await expect(
      as1((tx) => tx.insert(categories).values({ workspaceId: w1, name: 'casa', kind: 'expense' })),
    ).resolves.toBeDefined();
  });
});
