import { createHmac } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

const PASSWORD = 'senha-forte-123';

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of input.replace(/=+$/, '').toUpperCase()) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** TOTP (RFC 6238): SHA-1, 6 dígitos, janela de 30 s. `offset` desloca a janela. */
function totp(secretBase32: string, offset = 0): string {
  const counter = Math.floor(Date.now() / 30_000) + offset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', base32Decode(secretBase32)).update(msg).digest();
  const o = (h[h.length - 1] ?? 0) & 0xf;
  const code = (h.readUInt32BE(o) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}

const secretOf = (uri: string) => new URL(uri).searchParams.get('secret') ?? '';

function cookiesOf(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  return list
    .map((c) => c.split(';')[0] ?? '')
    .filter((c) => !c.endsWith('='))
    .join('; ');
}

type Activity = { event: string; ip: string | null; meta: Record<string, unknown> | null }[];

describe('2FA e registro de atividade', () => {
  let t: TestApp;
  let email = '';
  let session = '';
  let secret = '';
  let backup: string[] = [];

  const post = (url: string, payload: object, cookie = '') =>
    t.app.inject({
      method: 'POST',
      url,
      payload,
      headers: { cookie, origin: 'http://localhost:3000' },
    });
  const signIn = (who = email) =>
    post('/api/auth/sign-in/email', { email: who, password: PASSWORD });
  const activity = async (cookie = session) =>
    (await t.as(cookie)({ method: 'GET', url: '/v1/me/activity' })).json() as Activity;
  const count = async (event: string) => (await activity()).filter((a) => a.event === event).length;

  beforeAll(async () => {
    t = await createTestApp({ AUTH_RATE_LIMIT_PER_MINUTE: '1000', RATE_LIMIT_PER_MINUTE: '5000' });
    email = `sec-${Date.now()}@example.com`;
    session = (await t.signUp(email)).cookie;
  });
  afterAll(async () => {
    await t.close();
  });

  it('ativar sem verificar não bloqueia o login', async () => {
    const res = await post('/api/auth/two-factor/enable', { password: PASSWORD }, session);
    expect(res.statusCode).toBe(200);
    const body = res.json() as { totpURI: string; backupCodes: string[] };
    secret = secretOf(body.totpURI);
    backup = body.backupCodes;
    expect(secret).not.toBe('');
    expect(backup).toHaveLength(10);
    const login = await signIn();
    expect(login.statusCode).toBe(200);
    expect(login.json()).not.toHaveProperty('twoFactorRedirect');
    expect(await count('two_factor_enabled')).toBe(0);
  });

  it('senha errada não ativa', async () => {
    const res = await post('/api/auth/two-factor/enable', { password: 'errada-errada-1' }, session);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('código errado não verifica; código certo ativa e registra', async () => {
    const bad = await post('/api/auth/two-factor/verify-totp', { code: '000000' }, session);
    expect(bad.statusCode).toBeGreaterThanOrEqual(400);
    const ok = await post('/api/auth/two-factor/verify-totp', { code: totp(secret) }, session);
    expect(ok.statusCode).toBe(200);
    session = cookiesOf(ok) || session;
    expect(await count('two_factor_enabled')).toBe(1);
  });

  it('login pede o segundo passo e só dá sessão com o código certo', async () => {
    const before = await count('sign_in');
    const first = await signIn();
    expect(first.json()).toMatchObject({ twoFactorRedirect: true });
    const pending = cookiesOf(first);
    // Só a senha não dá acesso.
    expect((await t.as(pending)({ method: 'GET', url: '/v1/me' })).statusCode).toBe(401);
    expect(await count('sign_in')).toBe(before);

    const wrong = await post('/api/auth/two-factor/verify-totp', { code: '000000' }, pending);
    expect(wrong.statusCode).toBeGreaterThanOrEqual(400);
    expect(await count('sign_in')).toBe(before);

    const right = await post('/api/auth/two-factor/verify-totp', { code: totp(secret) }, pending);
    expect(right.statusCode).toBe(200);
    const full = `${cookiesOf(right)}`;
    expect((await t.as(full)({ method: 'GET', url: '/v1/me' })).statusCode).toBe(200);
    expect(await count('sign_in')).toBe(before + 1);
    const latest = (await activity()).find((a) => a.event === 'sign_in');
    expect(latest?.ip).toBeTruthy();
  });

  it('código de reserva vale uma vez', async () => {
    const code = backup[0] ?? '';
    const first = await signIn();
    const ok = await post('/api/auth/two-factor/verify-backup-code', { code }, cookiesOf(first));
    expect(ok.statusCode).toBe(200);
    const second = await signIn();
    const again = await post(
      '/api/auth/two-factor/verify-backup-code',
      { code },
      cookiesOf(second),
    );
    expect(again.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('novos códigos de reserva exigem a senha e invalidam os antigos', async () => {
    const denied = await post(
      '/api/auth/two-factor/generate-backup-codes',
      { password: 'errada-errada-1' },
      session,
    );
    expect(denied.statusCode).toBeGreaterThanOrEqual(400);
    const res = await post(
      '/api/auth/two-factor/generate-backup-codes',
      { password: PASSWORD },
      session,
    );
    expect(res.statusCode).toBe(200);
    const fresh = (res.json() as { backupCodes: string[] }).backupCodes;
    expect(fresh).toHaveLength(10);
    expect(await count('backup_codes_regenerated')).toBe(1);
    const oldCode = backup[1] ?? '';
    const attempt = await signIn();
    const stale = await post(
      '/api/auth/two-factor/verify-backup-code',
      { code: oldCode },
      cookiesOf(attempt),
    );
    expect(stale.statusCode).toBeGreaterThanOrEqual(400);
    backup = fresh;
  });

  it('o registro é só de quem o fez e o export traz sem segredos', async () => {
    const other = await t.signUp();
    expect(await activity(other.cookie)).toEqual([]);
    const exported = await t.as(session)({ method: 'GET', url: '/v1/me/export' });
    const text = exported.body;
    expect(exported.json().auditLogs.length).toBeGreaterThan(0);
    expect(exported.json().auditLogs[0]).not.toHaveProperty('userId');
    expect(text).not.toContain(secret);
    expect(text).not.toMatch(/backupCodes|totpURI/);
    expect(await count('data_exported')).toBe(1);
    await t.as(session)({ method: 'GET', url: '/v1/me/export.csv' });
    const csv = (await activity()).find((a) => a.event === 'data_exported');
    expect(csv?.meta).toMatchObject({ format: 'csv' });
  });

  it('rotas do plugin fora do fluxo ficam fechadas', async () => {
    const uri = await post('/api/auth/two-factor/get-totp-uri', { password: PASSWORD }, session);
    expect(uri.statusCode).toBe(404);
    expect(uri.body).not.toContain('secret=');
    // Pela rede, o caminho chega cru (o inject normaliza antes do roteador).
    await t.app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = t.app.server.address() as { port: number };
    for (const raw of [
      '/api/auth/x/../two-factor/verify-totp',
      '/api/auth/x/%2e%2e/sign-in/email',
    ]) {
      const status = await new Promise<number>((resolve, reject) => {
        const req = httpRequest(
          {
            host: '127.0.0.1',
            port,
            path: raw,
            method: 'POST',
            headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
          },
          (res) => {
            res.resume();
            resolve(res.statusCode ?? 0);
          },
        );
        req.on('error', reject);
        req.end('{}');
      });
      expect(status, raw).toBe(404);
    }
  });

  it('o servidor ignora confiar no dispositivo e disableSession', async () => {
    const before = await count('sign_in');
    const attempt = await signIn();
    const trusted = await post(
      '/api/auth/two-factor/verify-totp',
      { code: totp(secret), trustDevice: true },
      cookiesOf(attempt),
    );
    expect(trusted.statusCode).toBe(200);
    expect(JSON.stringify(trusted.headers['set-cookie'])).not.toContain('trust_device');
    expect(await count('sign_in')).toBe(before + 1);
    // Sem o cookie de confiança, o próximo login volta a pedir o código.
    expect((await signIn()).json()).toMatchObject({ twoFactorRedirect: true });

    const second = await signIn();
    const fake = await post(
      '/api/auth/two-factor/verify-backup-code',
      { code: backup[2] ?? '', disableSession: true },
      cookiesOf(second),
    );
    expect(fake.statusCode).toBe(200);
    expect(await count('sign_in')).toBe(before + 2);
  });

  it('desativar exige a senha e volta ao login simples', async () => {
    const denied = await post(
      '/api/auth/two-factor/disable',
      { password: 'errada-errada-1' },
      session,
    );
    expect(denied.statusCode).toBeGreaterThanOrEqual(400);
    const res = await post('/api/auth/two-factor/disable', { password: PASSWORD }, session);
    expect(res.statusCode).toBe(200);
    // Desativar renova a sessão.
    session = cookiesOf(res) || session;
    expect(await count('two_factor_disabled')).toBe(1);
    expect((await signIn()).json()).not.toHaveProperty('twoFactorRedirect');
  });

  it('excluir a conta apaga o registro', async () => {
    const me = await t.as(session)({ method: 'GET', url: '/v1/me' });
    const userId = (me.json() as { user: { id: string } }).user.id;
    const countRows = async () => {
      const client = await t.ownerDb.$client.connect();
      try {
        await client.query('begin');
        await client.query("select set_config('app.user_id', $1, true)", [userId]);
        const res = await client.query('select count(*)::int as n from audit_logs');
        await client.query('rollback');
        return res.rows[0].n as number;
      } finally {
        client.release();
      }
    };
    expect(await countRows()).toBeGreaterThan(0);
    const del = await t.as(session)({
      method: 'POST',
      url: '/v1/me/delete',
      payload: { password: PASSWORD, confirm: 'EXCLUIR' },
    });
    expect(del.statusCode).toBe(204);
    expect(await countRows()).toBe(0);
  });
});
