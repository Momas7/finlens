import { describe, expect, it } from 'vitest';
import {
  anomalies,
  budgetPace,
  categorySpike,
  duplicates,
  fees,
  generateInsights,
  savings,
  smallPurchases,
} from './generators';
import { ctx, e } from './test-helpers';

const food = { rootId: 'food', rootLabel: 'Alimentação' };
const active3 = ['2026-07', '2026-08', '2026-09'];

describe('categorySpike', () => {
  const history = [
    e('j', '2026-07-10', 40000n, food),
    e('a', '2026-08-10', 42000n, food),
    e('s', '2026-09-10', 38000n, food),
    e('late', '2026-09-25', 90000n, food),
  ];
  it('dispara acima de 30% e R$ 100 da mediana até o mesmo dia', () => {
    const out = categorySpike(
      ctx({ activeMonths: active3, expenses: [...history, e('o', '2026-10-05', 60000n, food)] }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: 'category_spike',
      severity: 'warning',
      impactCents: 20000n,
      dedupeKey: 'category_spike:2026-10:food',
      title: 'Alimentação acima do normal',
      body: 'R$ 600,00 até o dia 20, R$ 200,00 acima do normal para esta altura do mês.',
    });
    expect(out[0]?.action?.href).toBe(
      '/painel/transacoes?categoryId=food&from=2026-10-01&to=2026-10-31',
    );
  });
  it('precisa de 3 meses e dos dois limiares', () => {
    const now = e('o', '2026-10-05', 60000n, food);
    expect(
      categorySpike(ctx({ activeMonths: active3.slice(1), expenses: [...history, now] })),
    ).toEqual([]);
    expect(
      categorySpike(
        ctx({ activeMonths: active3, expenses: [...history, e('o', '2026-10-05', 51000n, food)] }),
      ),
    ).toEqual([]);
    const small = [
      e('j', '2026-07-10', 3000n, food),
      e('a', '2026-08-10', 3000n, food),
      e('s', '2026-09-10', 3000n, food),
      e('o', '2026-10-05', 11900n, food),
    ];
    expect(categorySpike(ctx({ activeMonths: active3, expenses: small }))).toEqual([]);
  });
  it('sem gasto no recorte de referência, não há "normal" para comparar', () => {
    const later = [
      e('j', '2026-07-25', 40000n, food),
      e('a', '2026-08-25', 40000n, food),
      e('s', '2026-09-25', 40000n, food),
    ];
    expect(
      categorySpike(ctx({ activeMonths: active3, expenses: [...later, e('o', '2026-10-05', 60000n, food)] })),
    ).toEqual([]);
    expect(
      categorySpike(ctx({ activeMonths: active3, expenses: [e('o', '2026-10-05', 60000n, food)] })),
    ).toEqual([]);
  });

  it('dia 31 recorta no último dia dos meses curtos', () => {
    const out = categorySpike(
      ctx({
        today: '2026-10-31',
        day: 31,
        activeMonths: active3,
        expenses: [
          e('j', '2026-07-31', 40000n, food),
          e('a', '2026-08-31', 40000n, food),
          e('s', '2026-09-30', 40000n, food),
          e('o', '2026-10-31', 40000n, food),
        ],
      }),
    );
    expect(out).toEqual([]);
  });
});

describe('smallPurchases', () => {
  const many = (n: number, amount: bigint) =>
    Array.from({ length: n }, (_, i) => e(`p${i}`, '2026-10-05', amount));
  it('10 compras abaixo de R$ 30 somando R$ 150', () => {
    const [out] = smallPurchases(ctx({ expenses: many(10, 1500n) }));
    expect(out).toMatchObject({
      severity: 'info',
      impactCents: 15000n,
      body: '10 compras abaixo de R$ 30 somam R$ 150,00 este mês.',
    });
  });
  it('não dispara abaixo dos limiares', () => {
    expect(smallPurchases(ctx({ expenses: many(9, 2000n) }))).toEqual([]);
    expect(smallPurchases(ctx({ expenses: many(10, 1400n) }))).toEqual([]);
    expect(smallPurchases(ctx({ expenses: many(12, 3000n) }))).toEqual([]);
  });
});

describe('anomalies', () => {
  const shell = { groupKey: 'm:shell', groupLabel: 'Shell', description: 'POSTO SHELL' };
  const history = ['04', '05', '06', '07', '08'].map((m) =>
    e(`h${m}`, `2026-${m}-10`, 15000n, shell),
  );
  it('valor muito acima do histórico do grupo', () => {
    const out = anomalies(ctx({ expenses: [...history, e('x', '2026-10-05', 48000n, shell)] }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: 'anomaly',
      severity: 'warning',
      impactCents: 33000n,
      dedupeKey: 'anomaly:x',
      body: 'Shell: R$ 480,00 em 05/10, normalmente R$ 150,00.',
    });
  });
  it('exige 5 no histórico, o dobro quando MAD é zero e grupo conhecido', () => {
    expect(
      anomalies(ctx({ expenses: [...history.slice(1), e('x', '2026-10-05', 48000n, shell)] })),
    ).toEqual([]);
    expect(anomalies(ctx({ expenses: [...history, e('x', '2026-10-05', 29000n, shell)] }))).toEqual(
      [],
    );
    const noGroup = history.map((h) => ({ ...h, groupKey: null }));
    expect(
      anomalies(ctx({ expenses: [...noGroup, e('x', '2026-10-05', 48000n, { groupKey: null })] })),
    ).toEqual([]);
  });
  it('z robusto com histórico variado', () => {
    const varied = [10000n, 11000n, 9000n, 10000n, 12000n].map((v, i) =>
      e(`v${i}`, `2026-0${i + 4}-10`, v, shell),
    );
    expect(
      anomalies(ctx({ expenses: [...varied, e('x', '2026-10-05', 30000n, shell)] })),
    ).toHaveLength(1);
    expect(anomalies(ctx({ expenses: [...varied, e('x', '2026-10-05', 14000n, shell)] }))).toEqual(
      [],
    );
  });
});

describe('fees', () => {
  it('tarifas é informativo; juros vira atenção', () => {
    const fee = e('f', '2026-10-03', 1200n, { categoryKey: 'financial.fees', rootId: 'fin' });
    expect(fees(ctx({ expenses: [fee] }))[0]).toMatchObject({
      severity: 'info',
      impactCents: 1200n,
    });
    const interest = e('i', '2026-10-04', 3000n, {
      categoryKey: 'financial.interest',
      rootId: 'fin',
    });
    expect(fees(ctx({ expenses: [fee, interest] }))[0]).toMatchObject({
      severity: 'warning',
      impactCents: 4200n,
      body: 'Você pagou R$ 42,00 em tarifas, juros e IOF este mês.',
    });
  });
});

describe('duplicates', () => {
  const nf = { groupKey: 'd:NETFLIX', groupLabel: 'NETFLIX', description: 'NETFLIX' };
  it('mesmo valor, conta e grupo em até 2 dias', () => {
    const out = duplicates(
      ctx({ expenses: [e('b', '2026-10-04', 5590n, nf), e('a', '2026-10-03', 5590n, nf)] }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      dedupeKey: 'duplicate:a:b',
      impactCents: 5590n,
      body: 'NETFLIX R$ 55,90 apareceu em 03/10 e 04/10.',
    });
  });
  it('3 dias, outra conta ou sem grupo não disparam; três geram dois pares', () => {
    expect(
      duplicates(
        ctx({ expenses: [e('a', '2026-10-01', 5590n, nf), e('b', '2026-10-04', 5590n, nf)] }),
      ),
    ).toEqual([]);
    expect(
      duplicates(
        ctx({
          expenses: [
            e('a', '2026-10-03', 5590n, nf),
            e('b', '2026-10-04', 5590n, { ...nf, accountId: 'other' }),
          ],
        }),
      ),
    ).toEqual([]);
    expect(
      duplicates(ctx({ expenses: [e('a', '2026-10-03', 5590n), e('b', '2026-10-04', 5590n)] })),
    ).toEqual([]);
    const three = duplicates(
      ctx({
        expenses: [
          e('a', '2026-10-03', 5590n, nf),
          e('b', '2026-10-04', 5590n, nf),
          e('c', '2026-10-05', 5590n, nf),
        ],
      }),
    );
    expect(three.map((i) => i.dedupeKey)).toEqual(['duplicate:a:b', 'duplicate:b:c']);
  });
});

describe('budgetPace', () => {
  const base = { categoryId: 'lz', label: 'Lazer', projectedCents: null, overOnDay: null };
  it('passou ou vai passar', () => {
    expect(
      budgetPace(
        ctx({ budgets: [{ ...base, limitCents: 15000n, spentCents: 18000n, state: 'over' }] }),
      )[0],
    ).toMatchObject({ title: 'Lazer passou do orçamento', impactCents: 3000n });
    expect(
      budgetPace(
        ctx({
          budgets: [
            {
              ...base,
              limitCents: 50000n,
              spentCents: 30000n,
              state: 'ok',
              overOnDay: 23,
              projectedCents: 62000n,
            },
          ],
        }),
      )[0],
    ).toMatchObject({
      title: 'Lazer deve passar do orçamento',
      impactCents: 12000n,
      body: 'No ritmo atual, passa do limite por volta do dia 23 e fecha em R$ 620,00.',
    });
    expect(
      budgetPace(
        ctx({ budgets: [{ ...base, limitCents: 50000n, spentCents: 1000n, state: 'ok' }] }),
      ),
    ).toEqual([]);
  });
});

describe('savings', () => {
  const totals = (rows: [string, bigint, bigint][]) =>
    rows.map(([month, incomeCents, expenseCents]) => ({ month, incomeCents, expenseCents }));
  it('faltou dinheiro no último mês fechado', () => {
    expect(savings(ctx({ monthTotals: totals([['2026-09', 500000n, 532000n]]) }))[0]).toMatchObject(
      {
        severity: 'warning',
        impactCents: 32000n,
        title: 'Faltou dinheiro em setembro',
        dedupeKey: 'savings:2026-09',
      },
    );
  });
  it('taxa caiu 10 p.p. em relação à mediana', () => {
    const out = savings(
      ctx({
        monthTotals: totals([
          ['2026-06', 100000n, 70000n],
          ['2026-07', 100000n, 75000n],
          ['2026-08', 100000n, 80000n],
          ['2026-09', 100000n, 90000n],
        ]),
      }),
    );
    expect(out[0]).toMatchObject({
      severity: 'info',
      impactCents: 15000n,
      body: 'Sobrou 10% da renda em setembro, abaixo dos 25% de costume.',
    });
  });
  it('sem entrada no mês fechado, nada', () =>
    expect(savings(ctx({ monthTotals: totals([['2026-09', 0n, 5000n]]) }))).toEqual([]));
});

describe('generateInsights', () => {
  it('usuário sem dados não quebra', () => expect(generateInsights(ctx())).toEqual([]));
});
