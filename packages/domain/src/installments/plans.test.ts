import { describe, expect, it } from 'vitest';
import { commitmentByMonth, detectInstallmentPlans, type InstallmentExpense } from './plans';

let n = 0;
const ex = (
  postedDate: string,
  current: number,
  total: number,
  amountCents = 19900,
  groupKey = 'd:MAGALU',
  accountId = 'acc',
): InstallmentExpense => ({
  id: `t${++n}`,
  postedDate,
  amountCents: BigInt(amountCents),
  accountId,
  description: `MAGALU PARC ${String(current).padStart(2, '0')}/${total}`,
  groupKey,
  groupLabel: 'MAGALU',
  installment: { current, total },
  explicit: true,
});
const TODAY = '2026-10-15';

describe('detectInstallmentPlans', () => {
  it('plano simples: 3 e 4 de 10', () => {
    const [p] = detectInstallmentPlans([ex('2026-09-05', 3, 10), ex('2026-10-05', 4, 10)], TODAY);
    expect(p).toMatchObject({
      label: 'MAGALU',
      total: 10,
      lastSeen: 4,
      seenCount: 2,
      installmentCents: 19900n,
      remaining: 6,
      lastSeenDate: '2026-10-05',
      nextDate: '2026-11-05',
      endDate: '2027-04-05',
      remainingCents: 119400n,
      status: 'active',
    });
    expect(p?.schedule).toHaveLength(6);
    expect(p?.schedule[0]).toEqual({ date: '2026-11-05', cents: 19900n });
  });

  it('uma parcela só já gera plano', () => {
    const [p] = detectInstallmentPlans([ex('2026-10-05', 1, 10)], TODAY);
    expect(p).toMatchObject({ remaining: 9, nextDate: '2026-11-05', seenCount: 1 });
  });

  it('dia 31, fevereiro e virada de ano', () => {
    const [p] = detectInstallmentPlans([ex('2026-12-31', 2, 5, 10000, 'd:X')], '2027-01-05');
    expect(p?.schedule.map((s) => s.date)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
    const leap = detectInstallmentPlans([ex('2027-12-31', 2, 4, 10000, 'd:Y')], '2028-01-05');
    expect(leap[0]?.schedule.map((s) => s.date)).toEqual(['2028-01-31', '2028-02-29']);
  });

  it('parcela não lançada: o cronograma começa no primeiro mês com data futura', () => {
    // última vista em 05/08; 05/09 passou sem lançamento; hoje é 15/10.
    const [p] = detectInstallmentPlans([ex('2026-08-05', 3, 10)], TODAY);
    expect(p?.status).toBe('stale');
    const [q] = detectInstallmentPlans([ex('2026-09-05', 3, 10)], TODAY);
    expect(q?.status).toBe('active');
    expect(q?.schedule[0]?.date).toBe('2026-11-05');
    expect(q?.remaining).toBe(7);
  });

  it('valor mediano e dia do mês pelo padrão', () => {
    const [p] = detectInstallmentPlans(
      [
        ex('2026-07-05', 1, 10, 19900),
        ex('2026-08-06', 2, 10, 20100),
        ex('2026-09-05', 3, 10, 19900),
      ],
      TODAY,
    );
    expect(p?.installmentCents).toBe(19900n);
    expect(p?.schedule[0]?.date).toBe('2026-11-05');
  });

  it('done quando a última parcela foi vista', () => {
    const [p] = detectInstallmentPlans([ex('2026-09-05', 9, 10), ex('2026-10-05', 10, 10)], TODAY);
    expect(p).toMatchObject({
      status: 'done',
      remaining: 0,
      remainingCents: 0n,
      endDate: '2026-10-05',
    });
    expect(p?.schedule).toEqual([]);
  });

  it('separa planos por valor, por total e por conta', () => {
    const plans = detectInstallmentPlans(
      [
        ex('2026-10-05', 2, 10, 19900),
        ex('2026-10-06', 1, 6, 55000),
        ex('2026-10-07', 2, 10, 39900),
        ex('2026-10-08', 2, 10, 19900, 'd:MAGALU', 'outra'),
      ],
      TODAY,
    );
    expect(plans).toHaveLength(4);
    // a mesma parcela do mesmo valor, em outra época (compra diferente), abre outro plano
    expect(
      detectInstallmentPlans([ex('2026-09-05', 2, 10), ex('2026-10-12', 2, 10)], TODAY),
    ).toHaveLength(2);
  });

  it('data no fim da descrição não é parcela: sem "PARC", exige 2 vistas', () => {
    const dated = (date: string, current: number): InstallmentExpense => ({
      ...ex(date, current, 10, 5000, 'd:UBER'),
      description: `UBER TRIP ${String(current).padStart(2, '0')}/10`,
      explicit: false,
    });
    expect(detectInstallmentPlans([dated('2026-10-05', 5)], TODAY)).toEqual([]);
    expect(
      detectInstallmentPlans([dated('2026-09-05', 4), dated('2026-10-05', 5)], TODAY),
    ).toHaveLength(1);
  });

  it('linha repetida (lançamento em dobro) não abre plano fantasma', () => {
    const plans = detectInstallmentPlans(
      [ex('2026-09-05', 3, 10), ex('2026-09-06', 3, 10), ex('2026-10-05', 4, 10)],
      TODAY,
    );
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ lastSeen: 4, seenCount: 2 });
  });

  it('chave única: inclui conta, total e a data da primeira parcela vista', () => {
    const plans = detectInstallmentPlans(
      [ex('2026-10-05', 2, 10, 19900, 'd:M', 'a'), ex('2026-10-05', 2, 10, 19900, 'd:M', 'b')],
      TODAY,
    );
    expect(new Set(plans.map((p) => p.key)).size).toBe(2);
    expect(plans[0]?.key).toContain(':10:2026-10-05');
  });

  it('rejeita grupo sem chave', () => {
    const bad = { ...ex('2026-10-05', 2, 10), groupKey: null };
    expect(detectInstallmentPlans([bad], TODAY)).toEqual([]);
  });

  it('estável com ordem embaralhada e vazio', () => {
    const items = [ex('2026-09-05', 3, 10), ex('2026-10-05', 4, 10)];
    expect(detectInstallmentPlans([...items].reverse(), TODAY)).toEqual(
      detectInstallmentPlans(items, TODAY),
    );
    expect(detectInstallmentPlans([], TODAY)).toEqual([]);
  });

  it('ativos primeiro, depois maior parcela', () => {
    const plans = detectInstallmentPlans(
      [
        ex('2026-10-05', 10, 10, 90000, 'd:A'),
        ex('2026-10-05', 2, 10, 10000, 'd:B'),
        ex('2026-10-05', 2, 10, 50000, 'd:C'),
      ],
      TODAY,
    );
    expect(plans.map((p) => p.key.split(':')[1])).toEqual(['C', 'B', 'A']);
  });
});

describe('commitmentByMonth', () => {
  const plans = detectInstallmentPlans(
    [ex('2026-10-05', 8, 10, 19900), ex('2026-10-05', 9, 10, 34900, 'd:NOTE')],
    TODAY,
  );
  it('soma por mês e só dos ativos', () => {
    expect(commitmentByMonth(plans, '2026-10')).toEqual([
      { month: '2026-10', cents: 0n },
      { month: '2026-11', cents: 54800n },
      { month: '2026-12', cents: 19900n },
    ]);
    const done = detectInstallmentPlans([ex('2026-10-05', 10, 10)], TODAY);
    expect(commitmentByMonth(done, '2026-10')).toEqual([]);
  });
  it('limita a 24 meses', () => {
    const long = detectInstallmentPlans([ex('2026-10-05', 1, 24, 1000, 'd:L')], TODAY);
    expect(commitmentByMonth(long, '2026-10', 12)).toHaveLength(12);
  });
});
