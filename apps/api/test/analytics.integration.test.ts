import {
  comparisonCutoff,
  lastMonths,
  monthRange,
  nextMonth,
  previousMonth,
  todayInSaoPaulo,
} from '@finlens/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

type Node = { id: string; name: string; children: Node[] };

const today = todayInSaoPaulo();
const current = today.slice(0, 7);
const day = Number(today.slice(8));
const prev = previousMonth(current);

describe('/v1/analytics/month', () => {
  let t: TestApp;

  async function setup() {
    const who = t.as((await t.signUp()).cookie);
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
    const add = (
      amountCents: string,
      description: string,
      category: string | null,
      postedDate = today,
    ) =>
      who({
        method: 'POST',
        url: '/v1/transactions',
        payload: {
          accountId: account,
          postedDate,
          amountCents,
          description,
          categoryId: category === null ? null : (ids[category] ?? category),
        },
      });
    const summary = async (query = '') =>
      who({ method: 'GET', url: `/v1/analytics/month${query}` });
    return { who, ids, add, summary };
  }

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => t?.close());

  it('totais do mês: entrada, saída, movimentação fora, sem categoria conta', async () => {
    const { add, summary, ids } = await setup();
    await add('720000', 'SALARIO', 'Receitas › Salário');
    await add('-185000', 'ALUGUEL', 'Moradia › Aluguel e financiamento');
    await add('-42350', 'MERCADO DIA', 'Alimentação › Mercado');
    await add('-10000', 'LOJA NOVA X', null);
    await add('-50000', 'TED PARA POUPANCA', 'Movimentação › Transferência entre contas');
    const res = await summary();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      month: current,
      isCurrent: true,
      asOfDay: day,
      incomeCents: '720000',
      expenseCents: '237350',
      netCents: '482650',
    });
    expect(body.categories).toEqual([
      {
        categoryId: ids.Moradia,
        label: 'Moradia',
        expenseCents: '185000',
        count: 1,
        limitCents: null,
      },
      {
        categoryId: ids.Alimentação,
        label: 'Alimentação',
        expenseCents: '42350',
        count: 1,
        limitCents: null,
      },
      {
        categoryId: null,
        label: 'Sem categoria',
        expenseCents: '10000',
        count: 1,
        limitCents: null,
      },
    ]);
  });

  it('estorno conta como entrada; filha arquivada continua somando na raiz', async () => {
    const { who, add, summary, ids } = await setup();
    await add('-3000', 'PADARIA', 'Alimentação › Padaria');
    await add('-2000', 'MERCADO', 'Alimentação › Mercado');
    await add('5000', 'ESTORNO MERCADO', 'Alimentação › Mercado');
    await who({ method: 'DELETE', url: `/v1/categories/${ids['Alimentação › Padaria']}` });
    const body = (await summary()).json();
    expect(body.incomeCents).toBe('5000');
    expect(body.expenseCents).toBe('5000');
    expect(body.categories).toEqual([
      {
        categoryId: ids.Alimentação,
        label: 'Alimentação',
        expenseCents: '5000',
        count: 2,
        limitCents: null,
      },
    ]);
  });

  it('comparação: até o mesmo dia no mês corrente, mês inteiro no passado', async () => {
    const { add, summary } = await setup();
    const prevRange = monthRange(prev);
    const cutoff = comparisonCutoff(current, day);
    await add('-1000', 'A', 'Alimentação › Mercado', prevRange.from);
    await add('-2000', 'B', 'Alimentação › Mercado', prevRange.to);
    await add('100000', 'SALARIO', 'Receitas › Salário', prevRange.from);
    const expectedUpToDay = 1000 + (prevRange.to <= cutoff ? 2000 : 0);
    const now = (await summary()).json();
    expect(now.comparison).toEqual({
      month: prev,
      upToDay: day,
      incomeCents: '100000',
      expenseCents: String(expectedUpToDay),
    });
    const past = (await summary(`?month=${prev}`)).json();
    expect(past).toMatchObject({
      month: prev,
      isCurrent: false,
      asOfDay: null,
      expenseCents: '3000',
    });
    expect(past.comparison).toMatchObject({ month: previousMonth(prev), upToDay: null });
  });

  it('histórico de 6 meses, com meses vazios e virada de ano', async () => {
    const { add, summary } = await setup();
    await add('-1500', 'A', 'Alimentação › Mercado', monthRange(prev).from);
    const body = (await summary()).json();
    expect(body.history.map((h: { month: string }) => h.month)).toEqual(lastMonths(current, 6));
    expect(body.history.at(-2)).toEqual({ month: prev, incomeCents: '0', expenseCents: '1500' });
    expect(body.history[0]).toMatchObject({ incomeCents: '0', expenseCents: '0' });
    const jan = (await summary('?month=2026-01')).json();
    expect(jan.history[0].month).toBe('2025-08');
  });

  it('pendingReview conta só os que precisam de você', async () => {
    const { add, summary } = await setup();
    await add('-1000', 'LOJA NOVA X', 'auto');
    await add('-4590', 'IFOOD*REST', 'auto');
    expect((await summary()).json().pendingReview).toBe(1);
  });

  it('isolado por usuário', async () => {
    const a = await setup();
    await a.add('720000', 'SALARIO', 'Receitas › Salário');
    const b = await setup();
    const body = (await b.summary()).json();
    expect(body).toMatchObject({ incomeCents: '0', expenseCents: '0', categories: [] });
  });

  it('mês inválido ou futuro → 400', async () => {
    const { summary } = await setup();
    for (const q of ['2026-13', 'abc', nextMonth(current)]) {
      expect((await summary(`?month=${q}`)).statusCode).toBe(400);
    }
  });

  it('filtro de transações por raiz inclui filhas', async () => {
    const { who, add, ids } = await setup();
    await add('-1000', 'PAO', 'Alimentação › Padaria');
    await add('-2000', 'FEIRA', 'Alimentação › Mercado');
    const list = async (id: string) =>
      (await who({ method: 'GET', url: `/v1/transactions?categoryId=${id}` })).json().items.length;
    expect(await list(ids.Alimentação as string)).toBe(2);
    expect(await list(ids['Alimentação › Mercado'] as string)).toBe(1);
  });
});
