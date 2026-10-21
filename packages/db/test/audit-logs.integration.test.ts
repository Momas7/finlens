import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLogs, createDb, type Db, user, withTenant } from '../src';
import { createTestDatabase } from './helpers/test-db';

describe('audit_logs', () => {
  let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
  let db: Db;
  let ownerDb: Db;
  const u1 = `user-${randomUUID()}`;
  const u2 = `user-${randomUUID()}`;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    ownerDb = createDb(testDb.ownerUrl);
    db = createDb(testDb.appUrl);
    await ownerDb.insert(user).values([
      { id: u1, name: 'Ana', email: `${u1}@example.com` },
      { id: u2, name: 'Bia', email: `${u2}@example.com` },
    ]);
    await withTenant(db, { userId: u1 }, (tx) =>
      tx.insert(auditLogs).values({ userId: u1, event: 'sign_in', ip: '10.0.0.1' }),
    );
  });
  afterAll(async () => {
    await ownerDb?.$client.end();
    await db?.$client.end();
    await testDb?.drop();
  });

  it('cada pessoa só enxerga o próprio registro', async () => {
    expect(await db.select().from(auditLogs)).toHaveLength(0);
    expect(await withTenant(db, { userId: u2 }, (tx) => tx.select().from(auditLogs))).toHaveLength(
      0,
    );
    expect(await withTenant(db, { userId: u1 }, (tx) => tx.select().from(auditLogs))).toHaveLength(
      1,
    );
  });

  it('não grava em nome de outra pessoa', async () => {
    await expect(
      withTenant(db, { userId: u2 }, (tx) =>
        tx.insert(auditLogs).values({ userId: u1, event: 'sign_in' }),
      ),
    ).rejects.toThrow();
  });

  it('apagar o usuário apaga os registros', async () => {
    await ownerDb.delete(user).where(eq(user.id, u1));
    expect(await ownerDb.select().from(auditLogs)).toHaveLength(0);
  });
});
