import { todayInSaoPaulo } from '@finlens/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

const today = todayInSaoPaulo();
const ago = (n: number) =>
  new Date(Date.parse(`${today}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

type Plan = {
  label: string;
  status: string;
  lastSeen: number;
  total: number;
  remaining: number;
  remainingCents: string;
  installmentCents: string;
};
type Body = {
  plans: Plan[];
  totals: { remainingCents: string; nextMonthCents: string; count: number };
  byMonth: { month: string; cents: string }[];
};

describe('/v1/installments', () => {
  let t: TestApp;

  async function setup() {
    const who = t.as((await t.signUp()).cookie);
    const inter = (
      await who({
        method: 'POST',
        url: '/v1/accounts',
        payload: { name: 'Inter', type: 'checking', openingBalanceDate: '2025-01-01' },
      })
    ).json().id as string;
    const add = (amountCents: string, description: string, postedDate: string) =>
      who({
        method: 'POST',
        url: '/v1/transactions',
        payload: { accountId: inter, postedDate, amountCents, description, categoryId: 'auto' },
      });
    const list = async () => (await who({ method: 'GET', url: '/v1/installments' })).json() as Body;
    const kinds = async () =>
      ((await who({ method: 'GET', url: '/v1/insights' })).json().items as { kind: string }[]).map(
        (i) => i.kind,
      );
    return { who, add, list, kinds };
  }

  beforeAll(async () => {
    t = await createTestApp({ AUTH_RATE_LIMIT_PER_MINUTE: '100' });
  });
  afterAll(async () => t?.close());

  it('parcelamento em andamento, concluído e parado', async () => {
    const { add, list } = await setup();
    for (const [k, n] of [
      [63, 1],
      [33, 2],
      [3, 3],
    ] as const)
      await add('-19900', `LOJA MAGALU PARC 0${n}/10`, ago(k));
    for (const [k, n] of [
      [3, 9],
      [0, 10],
    ] as const)
      await add('-34900', `NOTEBOOK DELL PARC ${String(n).padStart(2, '0')}/10`, ago(k));
    await add('-9000', 'RELOGIO SHOP PARC 02/06', ago(130));
    // marca inválida: "03/10" sem relação com parcela, 30 parcelas
    await add('-5000', 'PADARIA 03/30', ago(2));

    const body = await list();
    const byLabel = new Map(body.plans.map((p) => [p.label, p]));
    expect([...byLabel.keys()].sort()).toEqual(['Dell', 'Magalu', 'RELOGIO SHOP']);
    expect(byLabel.get('Magalu')).toMatchObject({
      status: 'active',
      lastSeen: 3,
      total: 10,
      remaining: 7,
      installmentCents: '19900',
      remainingCents: '139300',
    });
    expect(byLabel.get('Dell')).toMatchObject({ status: 'done', remaining: 0 });
    expect(byLabel.get('RELOGIO SHOP')?.status).toBe('stale');
    // Ativos primeiro; concluído e parado ao final.
    expect(body.plans[0]?.status).toBe('active');
    expect(body.plans[0]?.label).toBe('Magalu');
    expect(body.totals).toMatchObject({ remainingCents: '139300', count: 1 });
    expect(body.byMonth.length).toBeGreaterThan(6);
    expect(body.byMonth.reduce((s, m) => s + BigInt(m.cents), 0n)).toBe(139300n);
  });

  it('sem parcelas e isolado por usuário', async () => {
    const a = await setup();
    await a.add('-19900', 'LOJA MAGALU PARC 02/10', ago(3));
    expect((await a.list()).plans).toHaveLength(1);
    const b = await setup();
    expect(await b.list()).toEqual({
      plans: [],
      totals: { remainingCents: '0', nextMonthCents: '0', count: 0 },
      byMonth: [],
    });
  });

  it('recorrências continuam ignorando parcelas', async () => {
    const { who, add } = await setup();
    for (const k of [2, 1, 0])
      await add('-19900', `LOJA MAGALU PARC 0${3 - k}/10`, ago(3 + 30 * k));
    const body = (await who({ method: 'GET', url: '/v1/recurrences' })).json();
    expect(body.items).toEqual([]);
  });

  it('parcelamento terminando no mês seguinte vira insight', async () => {
    const { add, kinds } = await setup();
    // A última parcela vista é a 9 de 10, hoje: a 10ª cai no mês seguinte.
    await add('-34900', 'NOTEBOOK DELL PARC 07/10', ago(58));
    await add('-34900', 'NOTEBOOK DELL PARC 08/10', ago(29));
    await add('-34900', 'NOTEBOOK DELL PARC 09/10', ago(0));
    expect(await kinds()).toContain('installment_ending');
  });
});
