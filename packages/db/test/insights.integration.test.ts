import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createDb,
  type Db,
  ensurePersonalWorkspace,
  insightStates,
  user,
  withTenant,
} from '../src';
import { createTestDatabase } from './helpers/test-db';

describe('insight_states', () => {
  let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
  let db: Db;
  let ownerDb: Db;
  const u1 = `user-${randomUUID()}`;
  const u2 = `user-${randomUUID()}`;
  let w1 = '';
  let w2 = '';

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
    await withTenant(db, { userId: u1, workspaceId: w1 }, (tx) =>
      tx.insert(insightStates).values({ workspaceId: w1, dedupeKey: 'fees:2026-10' }),
    );
  });
  afterAll(async () => {
    await ownerDb?.$client.end();
    await db?.$client.end();
    await testDb?.drop();
  });

  it('isolada por workspace', async () => {
    expect(await db.select().from(insightStates)).toHaveLength(0);
    expect(
      await withTenant(db, { userId: u2, workspaceId: w2 }, (tx) =>
        tx.select().from(insightStates),
      ),
    ).toHaveLength(0);
    expect(
      await withTenant(db, { userId: u1, workspaceId: w1 }, (tx) =>
        tx.select().from(insightStates),
      ),
    ).toHaveLength(1);
  });

  it('não grava em outro workspace nem repete a chave', async () => {
    await expect(
      withTenant(db, { userId: u1, workspaceId: w1 }, (tx) =>
        tx.insert(insightStates).values({ workspaceId: w2, dedupeKey: 'x' }),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(db, { userId: u1, workspaceId: w1 }, (tx) =>
        tx.insert(insightStates).values({ workspaceId: w1, dedupeKey: 'fees:2026-10' }),
      ),
    ).rejects.toThrow();
  });
});
