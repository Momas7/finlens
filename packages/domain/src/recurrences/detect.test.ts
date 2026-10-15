import { describe, expect, it } from 'vitest';
import { detectRecurrences, type RecurrenceExpense } from './detect';

let n = 0;
const ex = (
  postedDate: string,
  amountCents: number,
  groupKey = 'm:netflix',
  groupLabel = 'Netflix',
): RecurrenceExpense => ({
  id: `t${++n}`,
  postedDate,
  amountCents: BigInt(amountCents),
  accountId: 'acc',
  description: groupLabel.toUpperCase(),
  groupKey,
  groupLabel,
});

const monthly = (amount: number | number[], key = 'm:netflix') => {
  const dates = [
    '2026-05-03',
    '2026-06-03',
    '2026-07-03',
    '2026-08-03',
    '2026-09-03',
    '2026-10-03',
  ];
  return dates.map((d, i) => ex(d, Array.isArray(amount) ? (amount[i] as number) : amount, key));
};
const TODAY = '2026-10-15';

describe('detectRecurrences', () => {
  it('mensal clássico', () => {
    const [r] = detectRecurrences(monthly(5590), TODAY);
    expect(r).toMatchObject({
      key: 'm:netflix',
      label: 'Netflix',
      cadence: 'monthly',
      typicalCents: 5590n,
      monthlyCents: 5590n,
      lastDate: '2026-10-03',
      nextExpectedDate: '2026-11-03',
      occurrences: 6,
      status: 'active',
      priceChange: null,
      isNew: false,
    });
  });

  it('semanal e trimestral', () => {
    const weekly = [
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
      '2026-09-22',
      '2026-09-29',
      '2026-10-06',
      '2026-10-13',
    ].map((d) => ex(d, 3000, 'd:diarista', 'Diarista'));
    expect(detectRecurrences(weekly, TODAY)[0]).toMatchObject({
      cadence: 'weekly',
      monthlyCents: 13000n,
    });
    const quarterly = ['2026-01-10', '2026-04-10', '2026-07-10'].map((d) =>
      ex(d, 90000, 'd:seguro', 'Seguro'),
    );
    expect(detectRecurrences(quarterly, TODAY)[0]).toMatchObject({
      cadence: 'quarterly',
      monthlyCents: 30000n,
    });
  });

  it('rejeita: 2 ocorrências, valores variáveis, intervalos irregulares, sem chave', () => {
    expect(detectRecurrences(monthly(5590).slice(0, 2), TODAY)).toEqual([]);
    expect(
      detectRecurrences(monthly([20000, 41000, 15000, 38000, 9000, 52000], 'm:mercado'), TODAY),
    ).toEqual([]);
    const irregular = ['2026-08-01', '2026-08-04', '2026-08-30', '2026-09-02', '2026-10-12'].map(
      (d) => ex(d, 3000, 'd:x'),
    );
    expect(detectRecurrences(irregular, TODAY)).toEqual([]);
    expect(
      detectRecurrences(
        monthly(5590).map((e) => ({ ...e, groupKey: null })),
        TODAY,
      ),
    ).toEqual([]);
  });

  it('tolerância de valor: ±10% passa, ±30% não', () => {
    expect(
      detectRecurrences(monthly([20000, 21800, 19000, 22000, 20500, 18500], 'd:luz'), TODAY),
    ).toHaveLength(1);
    expect(
      detectRecurrences(monthly([20000, 26000, 14000, 27000, 13500, 26500], 'd:luz'), TODAY),
    ).toEqual([]);
  });

  it('estados: ativa, atrasada, encerrada; trimestral atrasada fica ativa', () => {
    const [active] = detectRecurrences(monthly(5590), '2026-11-04');
    expect(active?.status).toBe('active');
    expect(
      detectRecurrences(monthly(5590), '2026-11-10', new Map([['acc', '2026-11-09']]))[0]?.status,
    ).toBe('late');
    expect(detectRecurrences(monthly(5590), '2026-12-15')[0]?.status).toBe('ended');
    const quarterly = ['2026-01-10', '2026-04-10', '2026-07-10'].map((d) =>
      ex(d, 90000, 'd:seguro'),
    );
    expect(detectRecurrences(quarterly, '2026-11-01')[0]?.status).toBe('active');
  });

  it('aumento de preço: 5% e R$ 2 nas últimas; valor isolado ou pequeno não vale', () => {
    const up = detectRecurrences(monthly([5590, 5590, 5590, 5590, 5990, 5990]), TODAY)[0];
    expect(up?.priceChange).toEqual({ fromCents: 5590n, toCents: 5990n });
    expect(up?.typicalCents).toBe(5990n);
    // sobe e volta: o último valor é o normal
    expect(
      detectRecurrences(monthly([5590, 5590, 5590, 5990, 5590, 5590]), TODAY)[0]?.priceChange,
    ).toBeNull();
    // menos de R$ 2
    expect(
      detectRecurrences(monthly([5590, 5590, 5590, 5590, 5700, 5700]), TODAY)[0]?.priceChange,
    ).toBeNull();
    // menos de 5%
    expect(
      detectRecurrences(
        monthly([100000, 100000, 100000, 100000, 103000, 103000], 'd:aluguel'),
        TODAY,
      )[0]?.priceChange,
    ).toBeNull();
    // aumento antigo (mais de 2 intervalos atrás) já virou o normal
    expect(
      detectRecurrences(monthly([5590, 5590, 5990, 5990, 5990, 5990]), TODAY)[0]?.priceChange,
    ).toBeNull();
  });

  it('nova: primeira ocorrência há no máximo 60 dias', () => {
    const fresh = ['2026-08-17', '2026-09-14', '2026-10-12'].map((d) =>
      ex(d, 2190, 'm:spotify', 'Spotify'),
    );
    expect(detectRecurrences(fresh, TODAY)[0]).toMatchObject({ isNew: true, occurrences: 3 });
    expect(detectRecurrences(monthly(5590), TODAY)[0]?.isNew).toBe(false);
  });

  it('duas cobranças no mesmo dia contam como uma', () => {
    const dup = [...monthly(5590), ex('2026-10-03', 5590)];
    expect(detectRecurrences(dup, TODAY)[0]?.occurrences).toBe(6);
  });

  it('estável: ordem embaralhada e vazio', () => {
    const items = monthly(5590);
    expect(detectRecurrences([...items].reverse(), TODAY)).toEqual(detectRecurrences(items, TODAY));
    expect(detectRecurrences([], TODAY)).toEqual([]);
  });

  it('anual: 3 cobranças em 3 anos', () => {
    const yearly = ['2024-03-10', '2025-03-10', '2026-03-10'].map((d) =>
      ex(d, 120000, 'd:ipva', 'IPVA'),
    );
    expect(detectRecurrences(yearly, TODAY)[0]).toMatchObject({
      cadence: 'annual',
      monthlyCents: 10000n,
    });
  });

  it('aumento grande (> 15%) não derruba a recorrência quando o patamar novo é consistente', () => {
    const values = [2190, 2190, 2190, 2190, 2190, 2190, 2190, 3490, 3490, 3490, 3490];
    const dates = [
      '2025-12-03',
      '2026-01-03',
      '2026-02-03',
      '2026-03-03',
      '2026-04-03',
      '2026-05-03',
      '2026-06-03',
      '2026-07-03',
      '2026-08-03',
      '2026-09-03',
      '2026-10-03',
    ];
    const items = dates.map((d, i) => ex(d, values[i] as number, 'm:spotify', 'Spotify'));
    expect(detectRecurrences(items, TODAY)[0]).toMatchObject({
      typicalCents: 3490n,
      status: 'active',
    });
  });

  it('cobrança no dia seguinte é a mesma ocorrência', () => {
    const items = ['2026-07-10', '2026-08-10', '2026-09-10', '2026-09-11'].map((d) => ex(d, 5590));
    expect(detectRecurrences(items, '2026-09-20')[0]?.occurrences).toBe(3);
  });

  it('atrasada só quando a conta tem dados mais novos que a data esperada', () => {
    const stale = new Map([['acc', '2026-10-01']]);
    expect(detectRecurrences(monthly(5590), '2026-11-10', stale)[0]?.status).toBe('active');
    expect(
      detectRecurrences(monthly(5590), '2026-11-10', new Map([['acc', '2026-11-09']]))[0]?.status,
    ).toBe('late');
  });

  it('ordena por custo mensal', () => {
    const list = detectRecurrences([...monthly(5590), ...monthly(120000, 'd:aluguel')], TODAY);
    expect(list.map((r) => r.key)).toEqual(['d:aluguel', 'm:netflix']);
  });
});
