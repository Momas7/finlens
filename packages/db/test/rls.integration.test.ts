import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db, user, withTenant, workspaceMembers, workspaces } from '../src';
import { createTestDatabase } from './helpers/test-db';

describe('RLS', () => {
  let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
  let ownerDb: Db;
  let db: Db;
  const u1 = `user-${randomUUID()}`;
  const u2 = `user-${randomUUID()}`;
  const w1 = randomUUID();
  const w2 = randomUUID();

  beforeAll(async () => {
    testDb = await createTestDatabase();
    ownerDb = createDb(testDb.ownerUrl);
    db = createDb(testDb.appUrl);

    await ownerDb.insert(user).values([
      { id: u1, name: 'Ana', email: `${u1}@example.com` },
      { id: u2, name: 'Bia', email: `${u2}@example.com` },
    ]);
    for (const [userId, workspaceId] of [
      [u1, w1],
      [u2, w2],
    ] as const) {
      await withTenant(ownerDb, { userId, workspaceId }, async (tx) => {
        await tx
          .insert(workspaces)
          .values({ id: workspaceId, name: 'Pessoal', personalOwnerId: userId });
        await tx.insert(workspaceMembers).values({ workspaceId, userId, role: 'owner' });
      });
    }
  });

  afterAll(async () => {
    await ownerDb?.$client.end();
    await db?.$client.end();
    await testDb?.drop();
  });

  it('app role não é superuser nem bypassa RLS', async () => {
    const result = await db.execute<{ rolsuper: boolean; rolbypassrls: boolean }>(
      sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
    );
    expect(result.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('sem contexto não vê nenhuma linha', async () => {
    expect(await db.select().from(workspaces)).toHaveLength(0);
    expect(await db.select().from(workspaceMembers)).toHaveLength(0);
  });

  it('usuário vê só o próprio workspace', async () => {
    const rows = await withTenant(db, { userId: u1 }, (tx) => tx.select().from(workspaces));
    expect(rows.map((r) => r.id)).toEqual([w1]);
  });

  it('workspace_id de outro tenant no contexto não abre acesso', async () => {
    const [ws, members] = await withTenant(db, { userId: u1, workspaceId: w2 }, (tx) =>
      Promise.all([tx.select().from(workspaces), tx.select().from(workspaceMembers)]),
    );
    expect(ws.map((r) => r.id)).toEqual([w1]);
    expect(members.map((r) => r.userId)).toEqual([u1]);
  });

  it('não consegue inserir workspace pessoal de outro usuário', async () => {
    await expect(
      withTenant(db, { userId: u1 }, (tx) =>
        tx.insert(workspaces).values({ name: 'x', personalOwnerId: u2 }),
      ),
    ).rejects.toMatchObject({ cause: { message: expect.stringMatching(/row-level security/) } });
  });

  it('contexto não vaza entre transações do pool', async () => {
    await withTenant(db, { userId: u1, workspaceId: w1 }, async () => {});
    expect(await db.select().from(workspaces)).toHaveLength(0);
  });
});
