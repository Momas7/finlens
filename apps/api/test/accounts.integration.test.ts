import { ensurePersonalWorkspace, transactions, withTenant } from '@finlens/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

describe('/v1/accounts', () => {
  let t: TestApp;
  let ana: ReturnType<TestApp['as']>;
  let anaId = '';
  let bia: ReturnType<TestApp['as']>;

  beforeAll(async () => {
    t = await createTestApp();
    const a = await t.signUp();
    anaId = a.userId;
    ana = t.as(a.cookie);
    bia = t.as((await t.signUp()).cookie);
  });
  afterAll(async () => t?.close());

  it('cria conta corrente e devolve saldo inicial', async () => {
    const res = await ana({
      method: 'POST',
      url: '/v1/accounts',
      payload: {
        name: 'Inter',
        type: 'checking',
        institution: 'Banco Inter',
        openingBalanceCents: '150000',
        openingBalanceDate: '2026-10-01',
      },
    });
    expect(res.statusCode).toBe(201);
    const list = await ana({ method: 'GET', url: '/v1/accounts' });
    expect(list.json()).toEqual([
      expect.objectContaining({ name: 'Inter', balanceCents: '150000', openInvoiceCents: null }),
    ]);
  });

  it('cria cartão e exige dias', async () => {
    const bad = await ana({
      method: 'POST',
      url: '/v1/accounts',
      payload: { name: 'MP', type: 'credit_card', dueDay: 17 },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.fields).toHaveProperty('closingDay');

    const ok = await ana({
      method: 'POST',
      url: '/v1/accounts',
      payload: { name: 'MP', type: 'credit_card', closingDay: 10, dueDay: 17 },
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json()).toMatchObject({
      type: 'credit_card',
      openInvoiceCents: '0',
      currentStatementMonth: expect.stringMatching(/^\d{4}-\d{2}-01$/),
      balanceCents: null,
    });
  });

  it('tipo é imutável', async () => {
    const created = await ana({
      method: 'POST',
      url: '/v1/accounts',
      payload: { name: 'Carteira', type: 'cash', openingBalanceDate: '2026-10-01' },
    });
    const res = await ana({
      method: 'PATCH',
      url: `/v1/accounts/${created.json().id}`,
      payload: { type: 'credit_card' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('mudar fechamento recalcula faturas', async () => {
    const card = (
      await ana({
        method: 'POST',
        url: '/v1/accounts',
        payload: { name: 'Nubank', type: 'credit_card', closingDay: 10, dueDay: 17 },
      })
    ).json();
    const { id: workspaceId } = await ensurePersonalWorkspace(t.db, anaId);
    await withTenant(t.db, { userId: anaId, workspaceId }, (tx) =>
      tx.insert(transactions).values({
        workspaceId,
        accountId: card.id,
        postedDate: '2026-10-15',
        statementMonth: '2026-11-01',
        amountCents: -1000n,
        description: 'compra',
        source: 'manual',
      }),
    );
    const res = await ana({
      method: 'PATCH',
      url: `/v1/accounts/${card.id}`,
      payload: { closingDay: 20 },
    });
    expect(res.statusCode).toBe(200);
    const [row] = await withTenant(t.db, { userId: anaId, workspaceId }, (tx) =>
      tx.select().from(transactions),
    );
    expect(row?.statementMonth).toBe('2026-10-01');
  });

  it('conta de outro usuário é 404', async () => {
    const id = (await ana({ method: 'GET', url: '/v1/accounts' })).json()[0].id;
    const patch = await bia({ method: 'PATCH', url: `/v1/accounts/${id}`, payload: { name: 'x' } });
    expect(patch.statusCode).toBe(404);
    expect(patch.json().error.code).toBe('not_found');
    const del = await bia({ method: 'DELETE', url: `/v1/accounts/${id}` });
    expect(del.statusCode).toBe(404);
  });

  it('arquivar some da lista', async () => {
    const created = await ana({
      method: 'POST',
      url: '/v1/accounts',
      payload: { name: 'Poupança', type: 'savings', openingBalanceDate: '2026-10-01' },
    });
    const del = await ana({ method: 'DELETE', url: `/v1/accounts/${created.json().id}` });
    expect(del.statusCode).toBe(204);
    const names = (await ana({ method: 'GET', url: '/v1/accounts' }))
      .json()
      .map((a: { name: string }) => a.name);
    expect(names).not.toContain('Poupança');
  });

  it('id inválido é 404', async () => {
    const res = await ana({
      method: 'PATCH',
      url: '/v1/accounts/nao-e-uuid',
      payload: { name: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });
});
