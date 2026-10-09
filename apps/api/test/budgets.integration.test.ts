import { randomUUID } from 'node:crypto';
import { budgets, ensurePersonalWorkspace, withTenant } from '@finlens/db';
import { monthRange, previousMonth, todayInSaoPaulo } from '@finlens/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

type Node = { id: string; name: string; children: Node[] };
type Item = { categoryId: string; label: string; limitCents: string | null };

const today = todayInSaoPaulo();
const current = today.slice(0, 7);
const prev = previousMonth(current);

describe('/v1/budgets', () => {
  let t: TestApp;

  async function setup() {
    const signed = await t.signUp();
    const who = t.as(signed.cookie);
    const account = (
      await who({
        method: 'POST',
        url: '/v1/accounts',
        payload: { name: 'Inter', type: 'checking', openingBalanceDate: '2025-01-01' },
      })
    ).json().id as string;
    const ids: Record<string, string> = {};
    const tree: Node[] = (await who({ method: 'GET', url: '/v1/categories' })).json();
    for (const root of tree) {
      ids[root.name] = root.id;
      for (const child of root.children) ids[`${root.name} › ${child.name}`] = child.id;
    }
    const add = (amountCents: string, category: string, postedDate = today) =>
      who({
        method: 'POST',
        url: '/v1/transactions',
        payload: {
          accountId: account,
          postedDate,
          amountCents,
          description: 'LANCAMENTO',
          categoryId: ids[category],
        },
      });
    const put = (category: string, amountCents: string) =>
      who({
        method: 'PUT',
        url: `/v1/budgets/${ids[category] ?? category}`,
        payload: { amountCents },
      });
    const get = async (query = '') =>
      (await who({ method: 'GET', url: `/v1/budgets${query}` })).json();
    const item = (body: { items: Item[] }, label: string) =>
      body.items.find((i) => i.label === label) as Item & Record<string, unknown>;
    const { id: workspaceId } = await ensurePersonalWorkspace(t.db, signed.userId);
    const asOwner = <T>(fn: Parameters<typeof withTenant<T>>[2]) =>
      withTenant(t.db, { userId: signed.userId, workspaceId }, fn);
    return { who, ids, add, put, get, item, asOwner, workspaceId };
  }

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => t?.close());

  it('define e lista', async () => {
    const { add, put, get, item } = await setup();
    expect((await put('Alimentação', '75000')).statusCode).toBe(200);
    await add('-61200', 'Alimentação › Mercado');
    const body = await get();
    expect(body).toMatchObject({ month: current, editable: true });
    expect(body.totals).toEqual({ budgetedCents: '75000', spentCents: '61200' });
    expect(body.items[0]).toMatchObject({
      label: 'Alimentação',
      limitCents: '75000',
      spentCents: '61200',
      state: 'warning',
      suggestion: null,
    });
    expect(body.items[0].share).toBeCloseTo(0.816, 3);
    expect(item(body, 'Transporte')).toMatchObject({ limitCents: null, state: null, pace: null });
    expect(body.items.some((i: Item) => i.label === 'Receitas' || i.label === 'Movimentação')).toBe(
      false,
    );
  });

  it('PUT de novo no mesmo mês sobrescreve; concorrente não quebra', async () => {
    const { put, get, item } = await setup();
    const results = await Promise.all([put('Alimentação', '50000'), put('Alimentação', '60000')]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
    expect(['50000', '60000']).toContain(item(await get(), 'Alimentação').limitCents);
    await put('Alimentação', '80000');
    expect(item(await get(), 'Alimentação').limitCents).toBe('80000');
  });

  it('vigência: mês anterior mantém o valor antigo e não é editável', async () => {
    const { ids, put, get, item, asOwner, workspaceId } = await setup();
    await asOwner((tx) =>
      tx.insert(budgets).values({
        workspaceId,
        categoryId: ids.Alimentação as string,
        effectiveFrom: monthRange(prev).from,
        amountCents: 50000n,
      }),
    );
    await put('Alimentação', '75000');
    const past = await get(`?month=${prev}`);
    expect(past).toMatchObject({ editable: false, isCurrent: false });
    expect(item(past, 'Alimentação')).toMatchObject({
      limitCents: '50000',
      suggestion: null,
      pace: null,
    });
    expect(item(await get(), 'Alimentação').limitCents).toBe('75000');
  });

  it('sem ritmo com menos de 3 saídas no mês (pagamento único não é ritmo)', async () => {
    const { add, put, get, item } = await setup();
    await put('Moradia', '190000');
    await add('-185000', 'Moradia › Aluguel e financiamento');
    expect(item(await get(), 'Moradia').pace).toBeNull();
  });

  it('remover vale a partir do mês corrente', async () => {
    const { who, ids, put, get, item } = await setup();
    await put('Alimentação', '75000');
    const del = () => who({ method: 'DELETE', url: `/v1/budgets/${ids.Alimentação}` });
    expect((await del()).statusCode).toBe(204);
    expect(item(await get(), 'Alimentação').limitCents).toBeNull();
    expect((await del()).statusCode).toBe(404);
  });

  it('categoria inválida', async () => {
    const { who, ids, put } = await setup();
    for (const c of ['Alimentação › Mercado', 'Receitas', 'Movimentação']) {
      expect((await put(c, '10000')).statusCode).toBe(409);
    }
    expect((await put(randomUUID(), '10000')).statusCode).toBe(404);
    await who({ method: 'DELETE', url: `/v1/categories/${ids.Lazer}` });
    expect((await put('Lazer', '10000')).statusCode).toBe(404);
    expect((await put('Alimentação', '0')).statusCode).toBe(400);
  });

  it('sugestão pela mediana dos meses com lançamento, e aplicar sugestões', async () => {
    const { who, add, get, item } = await setup();
    const m1 = previousMonth(previousMonth(prev));
    const m2 = previousMonth(prev);
    await add('-60000', 'Alimentação › Mercado', monthRange(m1).from);
    await add('100000', 'Receitas › Salário', monthRange(m2).from);
    expect(item(await get(), 'Alimentação').suggestion).toBeNull();
    await add('-72000', 'Alimentação › Mercado', monthRange(prev).from);
    expect(item(await get(), 'Alimentação').suggestion).toEqual({
      amountCents: '60000',
      months: 3,
    });
    const applied = await who({ method: 'POST', url: '/v1/budgets/apply-suggestions' });
    expect(applied.json()).toEqual({ created: 1 });
    expect(item(await get(), 'Alimentação')).toMatchObject({
      limitCents: '60000',
      suggestion: null,
    });
  });

  it('isolado por usuário e mês inválido', async () => {
    const a = await setup();
    await a.put('Alimentação', '75000');
    const b = await setup();
    expect(b.item(await b.get(), 'Alimentação').limitCents).toBeNull();
    expect((await b.who({ method: 'GET', url: '/v1/budgets?month=2026-13' })).statusCode).toBe(400);
  });

  it('analytics traz limite e alertas', async () => {
    const { who, add, put } = await setup();
    await put('Alimentação', '75000');
    await add('-61200', 'Alimentação › Mercado');
    const body = (await who({ method: 'GET', url: '/v1/analytics/month' })).json();
    expect(body.categories[0]).toMatchObject({ label: 'Alimentação', limitCents: '75000' });
    expect(body.budgetAlerts).toEqual({ warning: 1, over: 0 });
  });
});
