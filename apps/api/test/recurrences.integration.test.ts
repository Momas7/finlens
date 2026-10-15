import { todayInSaoPaulo } from '@finlens/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

const today = todayInSaoPaulo();
const ago = (n: number) =>
  new Date(Date.parse(`${today}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

type Item = {
  label: string;
  cadence: string;
  status: string;
  isNew: boolean;
  monthlyCents: string;
  priceChange: { fromCents: string; toCents: string } | null;
};

describe('/v1/recurrences', () => {
  let t: TestApp;

  async function setup() {
    const who = t.as((await t.signUp()).cookie);
    const mk = async (name: string, type: string) =>
      (
        await who({
          method: 'POST',
          url: '/v1/accounts',
          payload: { name, type, openingBalanceDate: '2025-01-01' },
        })
      ).json().id as string;
    const inter = await mk('Inter', 'checking');
    const reserva = await mk('Reserva', 'savings');
    const add = (accountId: string, amountCents: string, description: string, postedDate: string) =>
      who({
        method: 'POST',
        url: '/v1/transactions',
        payload: { accountId, postedDate, amountCents, description, categoryId: 'auto' },
      });
    const list = async () =>
      (await who({ method: 'GET', url: '/v1/recurrences' })).json() as {
        items: Item[];
        totals: { monthlyCents: string; count: number };
      };
    const kinds = async () =>
      ((await who({ method: 'GET', url: '/v1/insights' })).json().items as { kind: string }[]).map(
        (i) => i.kind,
      );
    return { who, inter, reserva, add, list, kinds };
  }

  beforeAll(async () => {
    t = await createTestApp({ AUTH_RATE_LIMIT_PER_MINUTE: '100' });
  });
  afterAll(async () => t?.close());

  it('assinatura com aumento de preço, assinatura nova e ruído fora', async () => {
    const { inter, add, list, kinds } = await setup();
    // Netflix: 5 cobranças a cada 30 dias, as 2 últimas mais caras.
    for (const [k, cents] of [
      [4, 5590],
      [3, 5590],
      [2, 5590],
      [1, 5990],
      [0, 5990],
    ] as const) {
      await add(inter, `-${cents}`, 'NETFLIX.COM', ago(3 + 30 * k));
    }
    // Spotify: 3 cobranças a cada 28 dias, a primeira há 59 dias.
    for (const k of [2, 1, 0]) await add(inter, '-2190', 'SPOTIFY AB', ago(3 + 28 * k));
    // Mercado: valores muito variáveis.
    for (const [d, cents] of [
      [40, 8000],
      [33, 31000],
      [20, 12000],
      [9, 45000],
    ] as const) {
      await add(inter, `-${cents}`, 'MERCADO DO BAIRRO', ago(d));
    }
    const { items, totals } = await list();
    const byLabel = new Map(items.map((i) => [i.label, i]));
    expect([...byLabel.keys()].sort()).toEqual(['Netflix', 'Spotify']);
    expect(byLabel.get('Netflix')).toMatchObject({
      cadence: 'monthly',
      status: 'active',
      priceChange: { fromCents: '5590', toCents: '5990' },
    });
    expect(byLabel.get('Spotify')).toMatchObject({ isNew: true, monthlyCents: '2190' });
    expect(totals).toEqual({ monthlyCents: '8180', count: 2 });
    expect(await kinds()).toEqual(expect.arrayContaining(['price_increase', 'new_subscription']));
  });

  it('cobrança que não veio vira atrasada e insight', async () => {
    const { inter, add, list, kinds } = await setup();
    for (let k = 5; k >= 0; k--) await add(inter, '-9990', 'SMARTFIT', ago(45 + 30 * k));
    const { items } = await list();
    expect(items[0]).toMatchObject({ label: 'Smart Fit', status: 'late' });
    expect(await kinds()).toContain('recurrence_missing');
  });

  it('transferências ligadas ficam de fora', async () => {
    const { inter, reserva, add, list } = await setup();
    for (const k of [2, 1, 0]) {
      await add(inter, '-50000', 'PIX TRANSF RESERVA', ago(5 + 30 * k));
      await add(reserva, '50000', 'PIX TRANSF RECEBIDO', ago(5 + 30 * k));
    }
    expect((await list()).items).toEqual([]);
  });

  it('isolado por usuário e vazio sem saídas', async () => {
    const a = await setup();
    for (const k of [2, 1, 0]) await a.add(a.inter, '-4000', 'ACADEMIA XYZ', ago(3 + 30 * k));
    expect((await a.list()).items).toHaveLength(1);
    const b = await setup();
    expect(await b.list()).toEqual({ items: [], totals: { monthlyCents: '0', count: 0 } });
  });
});
