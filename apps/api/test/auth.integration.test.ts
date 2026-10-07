import { Writable } from 'node:stream';
import { MeResponse } from '@finlens/contracts';
import { account, createDb, type Db, withTenant, workspaces } from '@finlens/db';
import { createTestDatabase } from '@finlens/db/testing';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';

const password = 'senha-forte-123';

describe('auth e /v1/me', () => {
  let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
  let ownerDb: Db;
  let db: Db;
  let app: FastifyInstance;
  const logLines: string[] = [];

  beforeAll(async () => {
    testDb = await createTestDatabase();
    ownerDb = createDb(testDb.ownerUrl);
    db = createDb(testDb.appUrl);
    const config = loadConfig({
      ...process.env,
      DATABASE_URL: testDb.appUrl,
      LOG_LEVEL: 'trace',
      // Proxy reverso de teste; o Next (127.0.0.1) fica fora da lista, como no padrão.
      TRUSTED_PROXIES: '10.9.9.9',
    });
    const stream = new Writable({
      write(chunk, _enc, cb) {
        logLines.push(chunk.toString());
        cb();
      },
    });
    app = await buildApp({ config, db, logger: { level: 'trace', stream } });
  });

  afterAll(async () => {
    await app?.close();
    await ownerDb?.$client.end();
    await db?.$client.end();
    await testDb?.drop();
  });

  async function signUp(email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { name: 'Ana', email, password },
    });
    expect(res.statusCode).toBe(200);
    const cookie = res.headers['set-cookie'];
    const raw = Array.isArray(cookie) ? cookie : [cookie ?? ''];
    return {
      userId: (res.json() as { user: { id: string } }).user.id,
      cookie: raw.map((c) => c.split(';')[0]).join('; '),
    };
  }

  it('GET /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'ok' });
  });

  it('GET /v1/me sem sessão -> 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/me' });
    expect(res.statusCode).toBe(401);
  });

  it('sign-up e /v1/me retornam usuário e workspace', async () => {
    const { cookie } = await signUp('ana@example.com');
    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(MeResponse.parse(me.json())).toMatchObject({
      user: { email: 'ana@example.com', name: 'Ana' },
      workspace: { name: 'Pessoal' },
    });
  });

  it('usuário sem workspace recebe um no /v1/me', async () => {
    const { userId, cookie } = await signUp('sem-workspace@example.com');
    await withTenant(ownerDb, { userId }, (tx) =>
      tx.delete(workspaces).where(eq(workspaces.personalOwnerId, userId)),
    );
    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(MeResponse.parse(me.json()).workspace.name).toBe('Pessoal');
  });

  it('senha guardada como argon2id', async () => {
    const { userId } = await signUp('hash@example.com');
    const [row] = await ownerDb.select().from(account).where(eq(account.userId, userId));
    expect(row?.password).toMatch(/^\$argon2id\$/);
  });

  it('logs não contêm senha nem cookie', async () => {
    const { cookie } = await signUp('logs@example.com');
    await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie } });
    const sessionValue = cookie.split('=').slice(1).join('=').split(';')[0] ?? '';
    const all = logLines.join('');
    expect(all).not.toContain(password);
    expect(sessionValue.length).toBeGreaterThan(10);
    expect(all).not.toContain(sessionValue);
  });

  it('sign-in limitado a 10/min por IP', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        remoteAddress: '203.0.113.7',
        payload: { email: 'ninguem@example.com', password: 'errada-123456' },
      });
      codes.push(res.statusCode);
    }
    expect(codes.slice(0, 10).every((c) => c !== 429)).toBe(true);
    expect(codes[10]).toBe(429);
  });

  async function signIn(remoteAddress: string, forwardedFor?: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      remoteAddress,
      headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
      payload: { email: 'ninguem@example.com', password: 'errada-123456' },
    });
    return res.statusCode;
  }

  it('atrás de proxy confiável, o limite vale por IP real', async () => {
    for (let i = 0; i < 10; i++) await signIn('10.9.9.9', '198.51.100.20');
    expect(await signIn('10.9.9.9', '198.51.100.20')).toBe(429);
    expect(await signIn('10.9.9.9', '198.51.100.21')).not.toBe(429);
  });

  it('pelo Next (não confiável), X-Forwarded-For forjado não troca o IP', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) codes.push(await signIn('127.0.0.1', `203.0.113.${100 + i}`));
    expect(codes[10]).toBe(429);
  });

  it('cliente direto não troca de IP forjando X-Forwarded-For', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) codes.push(await signIn('192.0.2.40', `198.51.100.${100 + i}`));
    expect(codes[10]).toBe(429);
  });

  it('logs do Better Auth passam pelo pino', async () => {
    await signUp('logger@example.com');
    const spies = (['log', 'info', 'warn', 'error'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    try {
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        remoteAddress: '192.0.2.77',
        payload: { email: 'logger@example.com', password: 'senha-errada-999' },
      });
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
      expect(logLines.join('')).toMatch(/better-auth/);
      expect(logLines.join('')).not.toContain('senha-errada-999');
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
