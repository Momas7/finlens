import { createDb, type Db } from '@finlens/db';
import { createTestDatabase } from '@finlens/db/testing';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';

export type TestApp = {
  app: FastifyInstance;
  db: Db;
  ownerDb: Db;
  signUp(email?: string): Promise<{ cookie: string; userId: string }>;
  as(cookie: string): (opts: InjectOptions) => Promise<LightMyRequestResponse>;
  close(): Promise<void>;
};

let counter = 0;

export async function createTestApp(): Promise<TestApp> {
  const testDb = await createTestDatabase();
  const ownerDb = createDb(testDb.ownerUrl);
  const db = createDb(testDb.appUrl);
  const config = loadConfig({ ...process.env, DATABASE_URL: testDb.appUrl, LOG_LEVEL: 'silent' });
  const app = await buildApp({ config, db });

  return {
    app,
    db,
    ownerDb,
    async signUp(email = `user${++counter}-${Date.now()}@example.com`) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { name: 'Teste', email, password: 'senha-forte-123' },
      });
      if (res.statusCode !== 200) throw new Error(`sign-up falhou: ${res.body}`);
      const raw = res.headers['set-cookie'];
      const cookies = Array.isArray(raw) ? raw : [raw ?? ''];
      return {
        userId: (res.json() as { user: { id: string } }).user.id,
        cookie: cookies.map((c) => c.split(';')[0]).join('; '),
      };
    },
    as(cookie) {
      return (opts) => app.inject({ ...opts, headers: { ...opts.headers, cookie } });
    },
    async close() {
      await app.close();
      await ownerDb.$client.end();
      await db.$client.end();
      await testDb.drop();
    },
  };
}
