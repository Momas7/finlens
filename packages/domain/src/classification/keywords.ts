export type KeywordMatch = { keyword: string; categoryKey: string; confidence: number };

const KEYWORDS: [string, string, number][] = [
  ['AUTO POSTO', 'transport.fuel', 0.8],
  ['POSTO', 'transport.fuel', 0.8],
  ['DROGARIA', 'health.pharmacy', 0.8],
  ['FARMACIA', 'health.pharmacy', 0.8],
  ['SUPERMERCADO', 'food.groceries', 0.75],
  ['MERCADO', 'food.groceries', 0.75],
  ['ATACADO', 'food.groceries', 0.75],
  ['HORTIFRUTI', 'food.groceries', 0.75],
  ['PADARIA', 'food.bakery', 0.78],
  ['PANIFICADORA', 'food.bakery', 0.78],
  ['RESTAURANTE', 'food.restaurants', 0.75],
  ['CHURRASCARIA', 'food.restaurants', 0.75],
  ['PIZZARIA', 'food.restaurants', 0.75],
  ['LANCHONETE', 'food.snacks', 0.72],
  ['CAFETERIA', 'food.snacks', 0.72],
  ['CAFE', 'food.snacks', 0.72],
  ['ESTACIONAMENTO', 'transport.parking_tolls', 0.78],
  ['PEDAGIO', 'transport.parking_tolls', 0.78],
  ['ACADEMIA', 'health.gym', 0.75],
  ['PET', 'pets', 0.72],
  ['IOF', 'financial.iof', 0.8],
  ['TARIFA', 'financial.fees', 0.78],
  ['ANUIDADE', 'financial.fees', 0.78],
  ['JUROS', 'financial.interest', 0.8],
  ['SALARIO', 'income.salary', 0.8],
  ['PAGAMENTO FATURA', 'movement.card_payment', 0.8],
];

/** Palavra-chave de maior confiança presente nos tokens (frases de duas palavras incluídas). */
export function matchKeyword(tokens: string[]): KeywordMatch | null {
  const padded = ` ${tokens.join(' ')} `;
  let best: KeywordMatch | null = null;
  for (const [keyword, categoryKey, confidence] of KEYWORDS) {
    if (padded.includes(` ${keyword} `) && (!best || confidence > best.confidence)) {
      best = { keyword, categoryKey, confidence };
    }
  }
  return best;
}
