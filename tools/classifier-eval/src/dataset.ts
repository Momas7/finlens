/**
 * Lançamentos sintéticos no formato dos extratos brasileiros, com a categoria que um usuário
 * escolheria (system_key). Nenhum dado real. Gerado de forma determinística (semente 42).
 */
export type Sample = { description: string; amountCents: bigint; expected: string };

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Template = {
  /** Variações de descrição como aparecem em extratos diferentes. */
  descriptions: string[];
  /** Faixa de valor em reais (saída). */
  min: number;
  max: number;
  expected: string | ((amountReais: number) => string);
  /** Quantas vezes aparece no dataset. */
  times: number;
};

const T: Template[] = [
  // Estabelecimentos do dicionário
  {
    descriptions: ['IFOOD*REST', 'IFD*IFOOD COM AGENCIA', 'IFOOD *PEDIDO 8812'],
    min: 25,
    max: 120,
    expected: 'food.delivery',
    times: 26,
  },
  {
    descriptions: ['RAPPI*RAPPI BRASIL', 'RAPPI BR'],
    min: 30,
    max: 110,
    expected: 'food.delivery',
    times: 6,
  },
  {
    descriptions: ['UBER *TRIP', 'UBER* PENDING', 'UBER *TRIP HELP.UBER.COM'],
    min: 9,
    max: 60,
    expected: 'transport.ride_hailing',
    times: 24,
  },
  {
    descriptions: ['99APP *99APP', '99 POP SAO PAULO'],
    min: 8,
    max: 45,
    expected: 'transport.ride_hailing',
    times: 8,
  },
  {
    descriptions: ['NETFLIX.COM', 'NETFLIX.COM SAO PAULO BRA'],
    min: 44.9,
    max: 59.9,
    expected: 'subscriptions.streaming',
    times: 6,
  },
  {
    descriptions: ['SPOTIFY', 'EBANX*SPOTIFY'],
    min: 21.9,
    max: 34.9,
    expected: 'subscriptions.music',
    times: 6,
  },
  {
    descriptions: ['DISNEY PLUS', 'GOOGLE *YOUTUBEPREMIUM'],
    min: 27.9,
    max: 43.9,
    expected: 'subscriptions.streaming',
    times: 5,
  },
  {
    descriptions: ['POSTO IPIRANGA SAO PAULO SP', 'AUTO POSTO IPIRANGA 2231'],
    min: 120,
    max: 320,
    expected: 'transport.fuel',
    times: 10,
  },
  {
    descriptions: ['SHELL BOX', 'POSTO SHELL 25/10'],
    min: 100,
    max: 280,
    expected: 'transport.fuel',
    times: 6,
  },
  {
    descriptions: ['CARREFOUR COM IND', 'CARREFOUR HIPER 0042'],
    min: 80,
    max: 650,
    expected: 'food.groceries',
    times: 12,
  },
  {
    descriptions: ['ASSAI ATACADISTA', 'PAO DE ACUCAR 1234'],
    min: 60,
    max: 540,
    expected: 'food.groceries',
    times: 10,
  },
  {
    descriptions: ['DROGASIL 1234 BELO HORIZONTE BR', 'DROGA RAIA 0099'],
    min: 18,
    max: 160,
    expected: 'health.pharmacy',
    times: 9,
  },
  {
    descriptions: ['PAG*ACADEMIA SMART FIT', 'SMARTFIT*MENSALIDADE'],
    min: 99.9,
    max: 129.9,
    expected: 'health.gym',
    times: 6,
  },
  {
    descriptions: ['STEAMGAMES.COM 4259522985', 'PAYPAL *STEAM GAMES'],
    min: 15,
    max: 250,
    expected: 'leisure.games',
    times: 6,
  },
  {
    descriptions: ['MCDONALDS 123456', 'BURGER KING 0021'],
    min: 25,
    max: 70,
    expected: 'food.restaurants',
    times: 8,
  },
  {
    descriptions: ['MP*MERCADOLIVRE', 'MERCADOLIVRE*MERCADOLIVRE'],
    min: 30,
    max: 400,
    expected: 'shopping.other',
    times: 8,
  },
  {
    descriptions: ['ENEL SP', 'DEB AUT ENEL SP'],
    min: 140,
    max: 260,
    expected: 'housing.electricity',
    times: 4,
  },
  {
    descriptions: ['VIVO FIXO', 'CLARO SA'],
    min: 99,
    max: 160,
    expected: 'housing.internet_phone',
    times: 5,
  },
  // O usuário trata compras grandes da Amazon como casa: o histórico precisa aprender por faixa.
  {
    descriptions: ['AMAZON BR', 'AMAZON MKTPLACE PMTS', 'AMZN Mktp BR'],
    min: 20,
    max: 900,
    expected: (v) => (v >= 200 ? 'shopping.home' : 'shopping.other'),
    times: 22,
  },
  // Comércios locais fora do dicionário
  {
    descriptions: ['PADARIA SAO JOAO', 'MERCADOPAGO*PADARIA SAO JOAO'],
    min: 8,
    max: 45,
    expected: 'food.bakery',
    times: 18,
  },
  {
    descriptions: ['RESTAURANTE DA VILMA', 'PG *RESTAURANTE DA VILMA'],
    min: 28,
    max: 75,
    expected: 'food.restaurants',
    times: 10,
  },
  {
    descriptions: ['MERCADINHO DO ZE', 'SUMUP *MERCADINHO DO ZE'],
    min: 12,
    max: 90,
    expected: 'food.groceries',
    times: 12,
  },
  {
    descriptions: ['ACOUGUE BOI GORDO', 'IZ *ACOUGUE BOI GORDO'],
    min: 40,
    max: 180,
    expected: 'food.groceries',
    times: 8,
  },
  {
    descriptions: ['BARBEARIA DO NEGO', 'PAG*BARBEARIA DO NEGO'],
    min: 35,
    max: 60,
    expected: 'personal.care',
    times: 6,
  },
  {
    descriptions: ['LAVANDERIA BOLHAS', 'EC *LAVANDERIA BOLHAS'],
    min: 30,
    max: 80,
    expected: 'personal.services',
    times: 6,
  },
  {
    descriptions: ['PIX ENVIADO MARIA CLARA'],
    min: 1800,
    max: 1800,
    expected: 'housing.rent',
    times: 6,
  },
  {
    descriptions: ['PIX ENVIADO JOAO DIARISTA', 'PIX ENVIADO JOAO DIARIST'],
    min: 150,
    max: 180,
    expected: 'personal.services',
    times: 8,
  },
  {
    descriptions: ['DROGARIA POPULAR', 'FARMACIA DO BAIRRO'],
    min: 12,
    max: 90,
    expected: 'health.pharmacy',
    times: 8,
  },
  {
    descriptions: ['ESTACIONAMENTO CENTRAL', 'PAG*ESTACIONAMENTO CENTRAL'],
    min: 10,
    max: 35,
    expected: 'transport.parking_tolls',
    times: 6,
  },
  {
    descriptions: ['IOF COMPRA INTERNACIONAL'],
    min: 1,
    max: 12,
    expected: 'financial.iof',
    times: 6,
  },
  {
    descriptions: ['TARIFA PACOTE SERVICOS'],
    min: 25,
    max: 25,
    expected: 'financial.fees',
    times: 4,
  },
  {
    descriptions: ['LOJA DA ESQUINA', 'PAG*LOJA DA ESQUINA'],
    min: 15,
    max: 120,
    expected: 'shopping.other',
    times: 8,
  },
  {
    descriptions: ['ACAI DO PORTO', 'SUMUP *ACAI DO PORTO'],
    min: 15,
    max: 35,
    expected: 'food.snacks',
    times: 8,
  },
];

function buildDataset(): Sample[] {
  const rand = mulberry32(42);
  const pool: Sample[] = [];
  for (const t of T) {
    for (let i = 0; i < t.times; i++) {
      const description = t.descriptions[Math.floor(rand() * t.descriptions.length)] as string;
      const reais = Math.round((t.min + rand() * (t.max - t.min)) * 100) / 100;
      const expected = typeof t.expected === 'function' ? t.expected(reais) : t.expected;
      pool.push({ description, amountCents: -BigInt(Math.round(reais * 100)), expected });
    }
  }
  // Embaralha (Fisher–Yates) para intercalar estabelecimentos como num extrato real.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j] as Sample, pool[i] as Sample];
  }
  return pool;
}

export const DATASET: Sample[] = buildDataset();
