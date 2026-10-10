import { user, withTenant } from '@finlens/db';
import { DEMO_EMAIL, DEMO_PASSWORD, generateDemo, runDemoSeed } from '@finlens/demo-seed';
import { todayInSaoPaulo } from '@finlens/domain';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, injectClient, type TestApp } from './helpers';

const today = todayInSaoPaulo();

describe('exportar e excluir dados', () => {
  let t: TestApp;
  const plan = generateDemo(today);
  let demo: ReturnType<typeof injectClient>;
  let demoUserId = '';
  let demoWorkspaceId = '';
  let bia: ReturnType<TestApp['as']>;

  const tenantTables = async () =>
    (
      await t.db.execute<{ table_name: string }>(
        sql`select distinct table_name from information_schema.columns where table_schema = 'public' and column_name = 'workspace_id' and table_name <> 'workspace_members'`,
      )
    ).rows.map((r) => r.table_name);

  beforeAll(async () => {
    t = await createTestApp({ RATE_LIMIT_PER_MINUTE: '10000', AUTH_RATE_LIMIT_PER_MINUTE: '100' });
    demo = injectClient(t.app);
    await runDemoSeed(demo, plan);
    const me = (await demo('GET', '/v1/me')).json as {
      user: { id: string };
      workspace: { id: string };
    };
    demoUserId = me.user.id;
    demoWorkspaceId = me.workspace.id;
    bia = t.as((await t.signUp()).cookie);
    const account = (
      await bia({
        method: 'POST',
        url: '/v1/accounts',
        payload: { name: 'Nubank', type: 'checking', openingBalanceDate: '2026-01-01' },
      })
    ).json().id;
    await bia({
      method: 'POST',
      url: '/v1/transactions',
      payload: {
        accountId: account,
        postedDate: today,
        amountCents: '-4590',
        description: 'CAFE; "BOM"',
        categoryId: null,
      },
    });
  });
  afterAll(async () => t?.close());

  const get = (path: string) =>
    t.app.inject({ method: 'GET', url: path, headers: { cookie: demo.cookie() } });

  it('exporta tudo da pessoa, sem auth e sem dados de outros', async () => {
    const res = await get('/v1/me/export');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toBe(`attachment; filename="finlens-${today}.json"`);
    const body = res.json();
    expect(body).toMatchObject({ format: 'finlens-export/1', user: { email: DEMO_EMAIL } });
    for (const key of [
      'accounts',
      'categories',
      'transactions',
      'classificationRules',
      'ruleSuggestionDismissals',
      'classificationFeedback',
      'budgets',
      'goals',
      'insightStates',
    ]) {
      expect(Array.isArray(body[key]), key).toBe(true);
    }
    expect(body.transactions).toHaveLength(plan.transactions.length);
    expect(body.goals).toHaveLength(1);
    expect(res.body).not.toMatch(/argon2|password|"token"|workspaceId/);
    expect(res.body).not.toContain('CAFE; ');
  });

  it('CSV de lançamentos para planilha', async () => {
    const res = await bia({ method: 'GET', url: '/v1/me/export.csv' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="finlens-lancamentos-${today}.csv"`,
    );
    expect(res.body).toBe(
      `﻿data;conta;descrição;valor;categoria;situação\r\n${today};Nubank;"CAFE; ""BOM""";-45,90;;sem categoria\r\n`,
    );
  });

  it('usuário sem dados exporta coleções vazias', async () => {
    const empty = t.as((await t.signUp()).cookie);
    const body = (await empty({ method: 'GET', url: '/v1/me/export' })).json();
    expect(body.transactions).toEqual([]);
    expect(body.accounts).toEqual([]);
  });

  it('exclusão exige EXCLUIR e a senha certa', async () => {
    expect(
      (await demo('POST', '/v1/me/delete', { password: DEMO_PASSWORD, confirm: 'excluir' })).status,
    ).toBe(400);
    const wrong = await demo('POST', '/v1/me/delete', {
      password: 'senha-errada-000',
      confirm: 'EXCLUIR',
    });
    expect(wrong.status).toBe(400);
    expect(wrong.json).toMatchObject({ error: { fields: { password: 'Senha incorreta.' } } });
    expect((await get('/v1/me')).statusCode).toBe(200);
  });

  it('exclusão válida apaga tudo da pessoa e mais nada', async () => {
    const res = await demo('POST', '/v1/me/delete', {
      password: DEMO_PASSWORD,
      confirm: 'EXCLUIR',
    });
    expect(res.status).toBe(204);
    expect((await get('/v1/me')).statusCode).toBe(401);
    const signIn = await t.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    });
    expect(signIn.statusCode).not.toBe(200);
    expect(await t.db.select().from(user).where(eq(user.id, demoUserId))).toEqual([]);
    const tables = await tenantTables();
    expect(tables.length).toBeGreaterThan(8);
    await withTenant(t.db, { userId: demoUserId, workspaceId: demoWorkspaceId }, async (tx) => {
      for (const table of tables) {
        const { rows } = await tx.execute<{ n: string }>(
          sql`select count(*)::text as n from ${sql.identifier(table)} where workspace_id = ${demoWorkspaceId}`,
        );
        expect(rows[0]?.n, table).toBe('0');
      }
    });
    const biaList = (await bia({ method: 'GET', url: '/v1/transactions' })).json();
    expect(biaList.items).toHaveLength(1);
  });
});
