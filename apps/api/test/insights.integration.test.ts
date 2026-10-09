import { ensurePersonalWorkspace, insightStates, withTenant } from '@finlens/db';
import { previousMonth, todayInSaoPaulo } from '@finlens/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

type Node = { id: string; name: string; children: Node[] };
type Item = { id: string; kind: string; severity: string; impactCents: string; isNew: boolean };

const today = todayInSaoPaulo();
const current = today.slice(0, 7);
const day = Number(today.slice(8));
const d = (n: number) => `${current}-${String(n).padStart(2, '0')}`;
const monthsAgo = (n: number) => {
  let m = current;
  for (let i = 0; i < n; i++) m = previousMonth(m);
  return m;
};

describe('/v1/insights', () => {
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
    const add = (amountCents: string, description: string, postedDate: string, category = 'auto') =>
      who({
        method: 'POST',
        url: '/v1/transactions',
        payload: {
          accountId: account,
          postedDate,
          amountCents,
          description,
          categoryId: ids[category] ?? category,
        },
      });
    const list = async (query = ''): Promise<Item[]> =>
      (await who({ method: 'GET', url: `/v1/insights${query}` })).json().items;
    const dismiss = (id: string) =>
      who({ method: 'POST', url: '/v1/insights/dismiss', payload: { id } });
    const { id: workspaceId } = await ensurePersonalWorkspace(t.db, signed.userId);
    const asOwner = <T>(fn: Parameters<typeof withTenant<T>>[2]) =>
      withTenant(t.db, { userId: signed.userId, workspaceId }, fn);
    return { who, add, list, dismiss, asOwner };
  }

  beforeAll(async () => {
    // Um usuário por cenário: passa do limite padrão de 10 cadastros por minuto.
    t = await createTestApp({ AUTH_RATE_LIMIT_PER_MINUTE: '100' });
  });
  afterAll(async () => t?.close());

  it('sem lançamentos', async () => {
    const { list } = await setup();
    expect(await list()).toEqual([]);
  });

  it.skipIf(day < 2)('duplicata', async () => {
    const { add, list } = await setup();
    await add('-5590', 'NETFLIX', d(1));
    await add('-5590', 'NETFLIX', d(2));
    const items = await list();
    expect(items).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^[0-9a-f]{16}$/),
        kind: 'duplicate',
        severity: 'warning',
        impactCents: '5590',
        isNew: true,
        action: expect.objectContaining({ label: 'Ver lançamentos' }),
      }),
    ]);
  });

  it.skipIf(day < 2)('novidade expira depois de 3 dias', async () => {
    const { add, list, asOwner } = await setup();
    await add('-5590', 'NETFLIX', d(1));
    await add('-5590', 'NETFLIX', d(2));
    await list();
    expect((await list())[0]?.isNew).toBe(true);
    const states = await asOwner((tx) => tx.select().from(insightStates));
    expect(states).toHaveLength(1);
    await asOwner((tx) =>
      tx.update(insightStates).set({ firstSeenAt: new Date(Date.now() - 4 * 86_400_000) }),
    );
    expect((await list())[0]?.isNew).toBe(false);
  });

  it.skipIf(day < 2)('dispensar', async () => {
    const { add, list, dismiss } = await setup();
    await add('-5590', 'NETFLIX', d(1));
    await add('-5590', 'NETFLIX', d(2));
    const [item] = await list();
    expect((await dismiss(item?.id as string)).statusCode).toBe(204);
    expect(await list()).toEqual([]);
    expect((await dismiss(item?.id as string)).statusCode).toBe(204);
    expect((await dismiss('0123456789abcdef')).statusCode).toBe(204);
    expect((await dismiss('x')).statusCode).toBe(400);
  });

  it.skipIf(day < 2)('anomalia e duplicata são independentes', async () => {
    const { add, list, dismiss } = await setup();
    for (let n = 1; n <= 5; n++) {
      await add('-15000', 'POSTO SHELL', `${monthsAgo(n)}-10`);
    }
    await add('-48000', 'POSTO SHELL', d(1));
    await add('-48000', 'POSTO SHELL', d(2));
    const items = await list();
    expect(items.filter((i) => i.kind === 'anomaly')).toHaveLength(2);
    const dup = items.find((i) => i.kind === 'duplicate');
    expect(dup).toBeDefined();
    await dismiss(dup?.id as string);
    const after = await list();
    expect(after.filter((i) => i.kind === 'anomaly')).toHaveLength(2);
    expect(after.some((i) => i.kind === 'duplicate')).toBe(false);
  });

  it('tarifas e juros', async () => {
    const { add, list } = await setup();
    await add('-1200', 'TARIFA PACOTE', today, 'Financeiro › Tarifas');
    await add('-3000', 'JUROS CHEQUE ESPECIAL', today, 'Financeiro › Juros');
    expect((await list()).find((i) => i.kind === 'fees')).toMatchObject({
      severity: 'warning',
      impactCents: '4200',
    });
  });

  it.skipIf(day < 2)('isolado por usuário', async () => {
    const a = await setup();
    await a.add('-5590', 'NETFLIX', d(1));
    await a.add('-5590', 'NETFLIX', d(2));
    const [item] = await a.list();
    const b = await setup();
    expect(await b.list()).toEqual([]);
    await b.dismiss(item?.id as string);
    expect(await a.list()).toHaveLength(1);
  });

  it('categoria acima do normal', async () => {
    const { add, list } = await setup();
    for (let n = 1; n <= 3; n++) {
      await add('-40000', 'MERCADO X', `${monthsAgo(n)}-01`, 'Alimentação › Mercado');
    }
    await add('-60000', 'MERCADO X', d(1), 'Alimentação › Mercado');
    expect((await list()).find((i) => i.kind === 'category_spike')).toMatchObject({
      severity: 'warning',
      impactCents: '20000',
    });
  });

  it('pequenas compras', async () => {
    const { add, list } = await setup();
    for (const letter of 'ABCDEFGHIJ') await add('-1500', `LOJA ${letter}${letter}`, d(1));
    expect((await list()).find((i) => i.kind === 'small_purchases')).toMatchObject({
      severity: 'info',
      impactCents: '15000',
    });
  });

  it('orçamento estourado', async () => {
    const { who, add, list } = await setup();
    const tree: Node[] = (await who({ method: 'GET', url: '/v1/categories' })).json();
    const leisure = tree.find((n) => n.name === 'Lazer')?.id as string;
    await who({ method: 'PUT', url: `/v1/budgets/${leisure}`, payload: { amountCents: '15000' } });
    await add('-18000', 'CINEMA', today, 'Lazer › Cinema e eventos');
    expect((await list()).find((i) => i.kind === 'budget_pace')).toMatchObject({
      title: 'Lazer passou do orçamento',
      impactCents: '3000',
    });
  });

  it('faltou dinheiro no mês fechado', async () => {
    const { add, list } = await setup();
    await add('-1000', 'PADARIA', `${monthsAgo(2)}-01`);
    await add('500000', 'SALARIO', `${monthsAgo(1)}-01`, 'Receitas › Salário');
    await add('-532000', 'ALUGUEL', `${monthsAgo(1)}-02`, 'Moradia › Aluguel e financiamento');
    expect((await list()).find((i) => i.kind === 'savings')).toMatchObject({
      severity: 'warning',
      impactCents: '32000',
    });
  });

  it('limit inválido', async () => {
    const { who } = await setup();
    for (const q of ['0', '21', 'abc']) {
      expect((await who({ method: 'GET', url: `/v1/insights?limit=${q}` })).statusCode).toBe(400);
    }
  });
});
