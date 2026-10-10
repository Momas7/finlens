import { lastMonths, type Month, monthRange } from '@finlens/domain';
import { prng } from './prng';

export const DEMO_EMAIL = 'demo@finlens.local';
export const DEMO_PASSWORD = 'demo-finlens-123';
export const DEMO_NAME = 'Demo';

export type DemoAccountName = 'Inter' | 'Mercado Pago' | 'Reserva';
export type DemoAccount = {
  name: DemoAccountName;
  type: 'checking' | 'savings' | 'credit_card';
  openingBalanceCents?: string;
  openingBalanceDate?: string;
  closingDay?: number;
  dueDay?: number;
};
export type DemoTx = {
  account: DemoAccountName;
  postedDate: string;
  amountCents: string;
  description: string;
  /** "Raiz › Filha", raiz, `null` (sem categoria) ou 'auto' (classificador decide). */
  category: string | null;
};
export type DemoGoal = {
  name: string;
  account: DemoAccountName;
  targetCents: string;
  targetDate: string;
  annualRatePercent: string;
};
export type DemoPlan = {
  accounts: DemoAccount[];
  transactions: DemoTx[];
  budgets: { category: string; amountCents: string }[];
  goals: DemoGoal[];
};

const MONTHS = 6;
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (m: Month) => Number(monthRange(m).to.slice(8));

/** Seis meses de vida financeira fictícia, relativos a `today`, com casos plantados para cada tela. */
export function generateDemo(today: string): DemoPlan {
  const current = today.slice(0, 7) as Month;
  const todayDay = Number(today.slice(8));
  const months = lastMonths(current, MONTHS);
  const rnd = prng(42);
  const txs: DemoTx[] = [];

  const add = (
    m: Month,
    day: number,
    account: DemoAccountName,
    cents: number,
    description: string,
    category: string,
    opts: { forceCategory?: boolean } = {},
  ) => {
    const isCurrent = m === current;
    const d = Math.min(day, lastDay(m));
    if (isCurrent && d > todayDay) return;
    txs.push({
      account,
      postedDate: `${m}-${pad(d)}`,
      amountCents: String(cents),
      description,
      // Meses fechados ficam confirmados (alimentam o histórico); o mês corrente fica no automático.
      category: isCurrent && !opts.forceCategory ? 'auto' : category,
    });
  };

  months.forEach((m, index) => {
    const isCurrent = m === current;
    const monthsBefore = MONTHS - 1 - index;
    add(m, 5, 'Inter', 720000, 'SALARIO ACME LTDA', 'Receitas › Salário');
    add(m, 10, 'Inter', -185000, 'ALUGUEL APTO 42', 'Moradia › Aluguel e financiamento');
    add(m, 10, 'Inter', -62000, 'CONDOMINIO EDIFICIO SOL', 'Moradia › Condomínio');
    add(m, 15, 'Inter', -rnd.int(18000, 24000), 'ENEL SP', 'Moradia › Energia');
    add(m, 12, 'Inter', -11990, 'VIVO FIBRA', 'Moradia › Internet e telefone');
    add(m, 7, 'Inter', -9990, 'SMARTFIT', 'Saúde › Academia');
    if (!isCurrent) add(m, 3, 'Inter', -5590, 'NETFLIX', 'Assinaturas › Streaming de vídeo');
    // Transferência para a Reserva: saída e entrada casadas.
    const transfer = 'Movimentação › Transferência entre contas';
    add(m, 6, 'Inter', -50000, 'TRANSFERENCIA RESERVA', transfer, { forceCategory: true });
    add(m, 6, 'Reserva', 50000, 'TRANSFERENCIA RESERVA', transfer, { forceCategory: true });

    for (const day of [2, 9, 16, 23]) {
      const shop = rnd.next() < 0.5 ? 'CARREFOUR' : 'PAO DE ACUCAR';
      add(m, day, 'Mercado Pago', -rnd.int(18000, 42000), shop, 'Alimentação › Mercado');
    }
    for (const day of [4, 8, 13, 19, 26]) {
      add(
        m,
        day,
        'Mercado Pago',
        -rnd.int(3500, 7500),
        'IFOOD*RESTAURANTE',
        'Alimentação › Delivery',
      );
    }
    for (const day of [3, 7, 11, 17, 22, 27]) {
      add(
        m,
        day,
        'Mercado Pago',
        -rnd.int(1500, 4500),
        'UBER *TRIP',
        'Transporte › App de transporte',
      );
    }
    for (const day of [6, 14, 21]) {
      add(m, day, 'Inter', -rnd.int(800, 2500), 'PADARIA PAO QUENTE', 'Alimentação › Padaria');
    }
    add(m, 18, 'Inter', -rnd.int(4000, 12000), 'DROGASIL', 'Saúde › Farmácia');
    add(
      m,
      24,
      'Mercado Pago',
      -rnd.int(5000, 25000),
      'AMAZON MARKETPLACE',
      'Compras › Casa e decoração',
    );
    if (!isCurrent) {
      add(m, 20, 'Inter', -rnd.int(15000, 19000), 'POSTO SHELL', 'Transporte › Combustível');
      add(m, 12, 'Mercado Pago', -rnd.int(4000, 9000), 'CINEMARK', 'Lazer › Cinema e eventos');
      add(m, 25, 'Mercado Pago', -rnd.int(4000, 9000), 'BAR DO ZE', 'Lazer › Bares');
    }
    // Regra sugerida: a mesma padaria confirmada nos três meses anteriores ao corrente.
    if (monthsBefore >= 1 && monthsBefore <= 3) {
      add(m, 14, 'Inter', -rnd.int(1200, 1600), 'PADARIA SAO JOAO', 'Alimentação › Padaria');
    }
  });

  // Plantados no mês corrente (datas até hoje).
  const at = (day: number) => Math.max(1, Math.min(day, todayDay));
  const dup1 = Math.max(1, Math.min(3, todayDay - 1));
  const dup2 = Math.min(todayDay, dup1 + 1);
  const plant = (
    day: number,
    account: DemoAccountName,
    cents: number,
    description: string,
    category: string,
  ) =>
    txs.push({
      account,
      postedDate: `${current}-${pad(day)}`,
      amountCents: String(cents),
      description,
      category,
    });
  plant(dup1, 'Inter', -5590, 'NETFLIX', 'Assinaturas › Streaming de vídeo');
  plant(dup2, 'Inter', -5590, 'NETFLIX', 'Assinaturas › Streaming de vídeo');
  plant(at(8), 'Inter', -48000, 'POSTO SHELL', 'Transporte › Combustível');
  plant(at(2), 'Inter', -3200, 'TARIFA PACOTE SERVICOS', 'Financeiro › Tarifas');
  plant(at(9), 'Mercado Pago', -412, 'IOF COMPRA INTERNACIONAL', 'Financeiro › IOF');
  plant(at(4), 'Inter', -9000, 'CINEMARK', 'Lazer › Cinema e eventos');
  plant(at(6), 'Mercado Pago', -13000, 'BAR DO ZE', 'Lazer › Bares');
  for (const [day, cents] of [
    [1, -2350],
    [5, -4100],
    [8, -1890],
  ] as const) {
    plant(at(day), 'Inter', cents, 'LOJA DO BAIRRO ZETA', 'auto');
  }

  txs.sort((a, b) => a.postedDate.localeCompare(b.postedDate));

  // Alimentação com o gasto do mês em ~85% do limite.
  const food = txs
    .filter(
      (t) =>
        t.postedDate.startsWith(current) &&
        t.description.match(/CARREFOUR|PAO DE ACUCAR|IFOOD|PADARIA/),
    )
    .reduce((s, t) => s - Number(t.amountCents), 0);
  const foodLimit = Math.max(5000, Math.ceil(food / 0.85 / 5000) * 5000);
  const opening = `${months[0]}-01`;

  return {
    accounts: [
      {
        name: 'Inter',
        type: 'checking',
        openingBalanceCents: '250000',
        openingBalanceDate: opening,
      },
      { name: 'Mercado Pago', type: 'credit_card', closingDay: 5, dueDay: 12 },
      {
        name: 'Reserva',
        type: 'savings',
        openingBalanceCents: '300000',
        openingBalanceDate: opening,
      },
    ],
    transactions: txs,
    budgets: [
      { category: 'Alimentação', amountCents: String(foodLimit) },
      { category: 'Lazer', amountCents: '15000' },
    ],
    goals: [
      {
        name: 'Reserva de emergência',
        account: 'Reserva',
        targetCents: '1500000',
        targetDate: `${Number(current.slice(0, 4)) + 1}-12-15`,
        annualRatePercent: '10,5',
      },
    ],
  };
}
