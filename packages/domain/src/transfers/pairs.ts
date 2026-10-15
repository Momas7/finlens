export type TransferCandidate = {
  id: string;
  accountId: string;
  postedDate: string;
  /** Com sinal: saída negativa, entrada positiva. */
  amountCents: bigint;
  descriptionNormalized: string;
};
export type TransferAccount = {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'cash' | 'credit_card';
};
export type TransferKind = 'transfer' | 'card_payment';
export type TransferPair = {
  /** A saída. */
  a: TransferCandidate;
  /** A entrada. */
  b: TransferCandidate;
  kind: TransferKind;
  reason: string;
  /** `idMenor:idMaior`, usada para dispensar o par. */
  key: string;
};

const MAX_DAYS = 2;
const AUTO_DAYS = 1;
const TRANSFER_WORDS = ['PIX', 'TED', 'DOC', 'TRANSFERENCIA', 'TRANSF'];
const CARD_WORDS = ['FATURA'];

/** Nome da conta como aparece em descrições normalizadas: maiúsculas, sem acento nem pontuação. */
export function normalizeAccountName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

const hasWord = (text: string, word: string) => ` ${text} `.includes(` ${word} `);
const daysBetween = (x: string, y: string) =>
  Math.abs(Math.round((Date.parse(`${x}T00:00:00Z`) - Date.parse(`${y}T00:00:00Z`)) / 86_400_000));
const ddmm = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/**
 * Acha as duas pontas de transferências e pagamentos de fatura. Liga sozinho só o óbvio
 * (até 1 dia, com menção no texto e sem ambiguidade); o resto vira sugestão.
 */
export function findTransferPairs(input: {
  candidates: TransferCandidate[];
  accounts: TransferAccount[];
  dismissed: Set<string>;
}): { auto: TransferPair[]; suggested: TransferPair[] } {
  const accounts = new Map(input.accounts.map((a) => [a.id, a]));
  const outs = input.candidates.filter((c) => c.amountCents < 0n);
  const ins = input.candidates.filter((c) => c.amountCents > 0n);

  type Possible = { a: TransferCandidate; b: TransferCandidate; kind: TransferKind; days: number };
  const possible: Possible[] = [];
  for (const a of outs) {
    for (const b of ins) {
      if (a.accountId === b.accountId || a.amountCents !== -b.amountCents) continue;
      const accountA = accounts.get(a.accountId);
      const accountB = accounts.get(b.accountId);
      if (!accountA || !accountB) continue;
      // O pagamento entra como crédito no cartão; compra no cartão nunca é a ponta de saída.
      if (accountA.type === 'credit_card') continue;
      const days = daysBetween(a.postedDate, b.postedDate);
      if (days > MAX_DAYS) continue;
      const key = [a.id, b.id].sort().join(':');
      if (input.dismissed.has(key)) continue;
      possible.push({
        a,
        b,
        kind: accountB.type === 'credit_card' ? 'card_payment' : 'transfer',
        days,
      });
    }
  }

  const countFor = new Map<string, number>();
  for (const p of possible) {
    countFor.set(p.a.id, (countFor.get(p.a.id) ?? 0) + 1);
    countFor.set(p.b.id, (countFor.get(p.b.id) ?? 0) + 1);
  }

  const auto: TransferPair[] = [];
  const suggested: TransferPair[] = [];
  for (const p of possible) {
    const accountA = accounts.get(p.a.accountId) as TransferAccount;
    const accountB = accounts.get(p.b.accountId) as TransferAccount;
    const words = p.kind === 'card_payment' ? CARD_WORDS : TRANSFER_WORDS;
    const candidatesWords = [
      ...words,
      normalizeAccountName(accountB.name),
      normalizeAccountName(accountA.name),
    ].filter(Boolean);
    const texts = [p.a.descriptionNormalized, p.b.descriptionNormalized];
    const mention = candidatesWords.find((w) => texts.some((t) => hasWord(t, w)));
    const dates = `em ${ddmm(p.a.postedDate)} e ${ddmm(p.b.postedDate)}`;
    const pair: TransferPair = {
      a: p.a,
      b: p.b,
      kind: p.kind,
      key: [p.a.id, p.b.id].sort().join(':'),
      reason: `Valores iguais e opostos ${dates}${mention ? `, com ${mention} no texto` : ''}.`,
    };
    const unique = countFor.get(p.a.id) === 1 && countFor.get(p.b.id) === 1;
    (p.days <= AUTO_DAYS && mention && unique ? auto : suggested).push(pair);
  }
  return { auto, suggested };
}
