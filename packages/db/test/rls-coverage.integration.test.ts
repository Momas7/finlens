import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertAppRoleIsSafe, createDb, type Db, tablesWithoutForcedRls } from '../src';
import { createTestDatabase } from './helpers/test-db';

describe('cobertura de RLS e role da aplicação', () => {
  let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
  let db: Db;
  let ownerDb: Db;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    db = createDb(testDb.appUrl);
    ownerDb = createDb(testDb.ownerUrl);
  });
  afterAll(async () => {
    await db?.$client.end();
    await ownerDb?.$client.end();
    await testDb?.drop();
  });

  it('toda tabela de public, fora as do Better Auth, tem RLS ENABLE e FORCE', async () => {
    expect(await tablesWithoutForcedRls(ownerDb)).toEqual([]);
  });

  it('detecta tabela nova sem RLS', async () => {
    await ownerDb.$client.query('create table sem_rls (id int)');
    try {
      expect(await tablesWithoutForcedRls(ownerDb)).toEqual(['sem_rls']);
    } finally {
      await ownerDb.$client.query('drop table sem_rls');
    }
  });

  it('aceita o role da aplicação', async () => {
    await expect(assertAppRoleIsSafe(db)).resolves.toBeUndefined();
  });

  it('recusa superuser', async () => {
    const admin = new URL(process.env.TEST_DATABASE_ADMIN_URL ?? '');
    admin.pathname = new URL(testDb.appUrl).pathname;
    const superDb = createDb(admin.toString());
    try {
      await expect(assertAppRoleIsSafe(superDb)).rejects.toThrow(/superuser ou BYPASSRLS/);
    } finally {
      await superDb.$client.end();
    }
  });
});
