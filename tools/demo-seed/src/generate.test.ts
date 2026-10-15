import { DEFAULT_CATEGORIES } from '@finlens/domain';
import { describe, expect, it } from 'vitest';
import { type DemoTx, generateDemo } from './generate';

const labels = new Set<string>();
for (const c of DEFAULT_CATEGORIES) {
  const parent = DEFAULT_CATEGORIES.find((p) => p.key === c.parentKey);
  labels.add(parent ? `${parent.name} › ${c.name}` : c.name);
}

const inMonth = (txs: DemoTx[], month: string) => txs.filter((t) => t.postedDate.startsWith(month));

describe('generateDemo', () => {
  const plan = generateDemo('2026-10-10');

  it('é determinístico e não gera datas futuras', () => {
    expect(generateDemo('2026-10-10')).toEqual(plan);
    expect(plan.transactions.every((t) => t.postedDate <= '2026-10-10')).toBe(true);
    expect(plan.transactions.some((t) => t.postedDate < '2026-06-01')).toBe(true);
  });

  it('usa só categorias que existem', () => {
    const used = plan.transactions
      .map((t) => t.category)
      .filter((c): c is string => c !== null && c !== 'auto');
    for (const c of [
      ...used,
      ...plan.budgets.map((b) => b.category),
      ...plan.rules.map((r) => r.category),
    ])
      expect(labels).toContain(c);
  });

  it('cria regras para os recorrentes e deixa a padaria nova como sugestão', () => {
    const patterns = plan.rules.map((r) => r.pattern);
    expect(patterns).toEqual(
      expect.arrayContaining(['UBER TRIP', 'IFOOD', 'CARREFOUR', 'NETFLIX']),
    );
    expect(patterns.some((p) => p.includes('SAO JOAO'))).toBe(false);
  });

  it('planta duplicata, valor fora do padrão, tarifas e revisão', () => {
    const now = inMonth(plan.transactions, '2026-10');
    const netflix = now.filter((t) => t.description === 'NETFLIX' && t.amountCents === '-5990');
    expect(netflix).toHaveLength(2);
    const shell = plan.transactions.filter((t) => t.description === 'POSTO SHELL');
    const before = shell.filter((t) => t.postedDate < '2026-10-01');
    expect(before.length).toBeGreaterThanOrEqual(5);
    expect(
      before.every((t) => -Number(t.amountCents) >= 15000 && -Number(t.amountCents) <= 19000),
    ).toBe(true);
    expect(now.filter((t) => t.description === 'POSTO SHELL').map((t) => t.amountCents)).toEqual([
      '-48000',
    ]);
    expect(now.some((t) => t.category === 'Financeiro › Tarifas')).toBe(true);
    expect(now.some((t) => t.category === 'Financeiro › IOF')).toBe(true);
    const zeta = now.filter((t) => t.description === 'LOJA DO BAIRRO ZETA');
    expect(zeta).toHaveLength(3);
    expect(zeta.every((t) => t.category === 'auto')).toBe(true);
  });

  it('padaria confirmada 3 vezes e transferências balanceadas', () => {
    const bakery = plan.transactions.filter((t) => t.description === 'PADARIA SAO JOAO');
    expect(bakery).toHaveLength(3);
    expect(
      bakery.every((t) => t.category === 'Alimentação › Padaria' && t.postedDate < '2026-10-01'),
    ).toBe(true);
    const transfers = plan.transactions.filter((t) => t.description.startsWith('PIX TRANSF'));
    expect(transfers.every((t) => t.category === 'auto')).toBe(true);
    const out = transfers
      .filter((t) => t.account === 'Inter')
      .reduce((s, t) => s + Number(t.amountCents), 0);
    const inn = transfers
      .filter((t) => t.account === 'Reserva')
      .reduce((s, t) => s + Number(t.amountCents), 0);
    expect(out).toBe(-inn);
    expect(inn).toBeGreaterThan(0);
  });

  it('Spotify novo (3 cobranças a cada 28 dias) e Netflix mais cara', () => {
    const spotify = plan.transactions.filter((t) => t.description === 'SPOTIFY AB');
    expect(spotify.map((t) => t.postedDate)).toEqual(['2026-08-12', '2026-09-09', '2026-10-07']);
    const netflix = plan.transactions.filter((t) => t.description === 'NETFLIX');
    expect(netflix.filter((t) => t.amountCents === '-5590').length).toBeGreaterThanOrEqual(5);
  });

  it('dois parcelamentos: Magalu em andamento e notebook na penúltima parcela', () => {
    const magalu = plan.transactions.filter((t) => t.description.startsWith('MAGALU PARC'));
    expect(magalu.map((t) => t.description)).toEqual([
      'MAGALU PARC 01/10',
      'MAGALU PARC 02/10',
      'MAGALU PARC 03/10',
    ]);
    const notebook = plan.transactions.filter((t) =>
      t.description.startsWith('NOTEBOOK DELL PARC'),
    );
    expect(notebook.map((t) => t.postedDate).at(-1)).toBe('2026-10-10');
  });

  it('orçamento de Lazer estourado e meta na Reserva', () => {
    expect(plan.budgets).toContainEqual({ category: 'Lazer', amountCents: '15000' });
    const leisure = inMonth(plan.transactions, '2026-10')
      .filter((t) => t.category?.startsWith('Lazer'))
      .reduce((s, t) => s - Number(t.amountCents), 0);
    expect(leisure).toBeGreaterThanOrEqual(22000);
    expect(plan.goals).toEqual([
      expect.objectContaining({
        name: 'Reserva de emergência',
        account: 'Reserva',
        targetCents: '1500000',
      }),
    ]);
  });

  it('no dia 1 do mês continua sem datas futuras e com a duplicata', () => {
    const first = generateDemo('2026-11-01');
    expect(first.transactions.every((t) => t.postedDate <= '2026-11-01')).toBe(true);
    expect(
      inMonth(first.transactions, '2026-11').filter((t) => t.description === 'NETFLIX'),
    ).toHaveLength(2);
  });
});
