import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createDb,
  type Db,
  ensurePersonalWorkspace,
  user,
  withTenant,
  workspaceMembers,
  workspaces,
} from '../src';
import { createTestDatabase } from './helpers/test-db';

describe('ensurePersonalWorkspace', () => {
  let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
  let ownerDb: Db;
  let db: Db;
  const userId = `user-${randomUUID()}`;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    ownerDb = createDb(testDb.ownerUrl);
    db = createDb(testDb.appUrl);
    await ownerDb.insert(user).values({ id: userId, name: 'Ana', email: `${userId}@example.com` });
  });

  afterAll(async () => {
    await ownerDb?.$client.end();
    await db?.$client.end();
    await testDb?.drop();
  });

  it('chamadas concorrentes criam um único workspace pessoal', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => ensurePersonalWorkspace(db, userId)),
    );
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(results[0]?.name).toBe('Pessoal');

    const [ws, members] = await withTenant(ownerDb, { userId }, (tx) =>
      Promise.all([tx.select().from(workspaces), tx.select().from(workspaceMembers)]),
    );
    expect(ws).toHaveLength(1);
    expect(members).toEqual([expect.objectContaining({ userId, role: 'owner' })]);
  });
});
