export type Normalized = {
  /** Descrição limpa: maiúsculas, sem acento, sem gateway, parcela, cidade/UF e números longos. */
  normalized: string;
  tokens: string[];
  gateway: string | null;
  installment: { current: number; total: number } | null;
  /** Nome de quem enviou/recebeu, em PIX. */
  counterparty: string | null;
};

export type AmountBucket = 'xs' | 'sm' | 'md' | 'lg';

// Ordem importa: prefixos mais longos antes (PAGSEGURO antes de PAG, MERCADOPAGO antes de MP).
const GATEWAYS = [
  'PAGSEGURO',
  'MERCADOPAGO',
  'PAYPAL',
  'PICPAY',
  'SUMUP',
  'EBANX',
  'PAG',
  'MP',
  'PG',
  'IZ',
  'EC',
];
const GATEWAY_RE = new RegExp(`^(${GATEWAYS.join('|')})\\s*\\*\\s*`);

const BANK_PREFIXES = [
  'COMPRA NO DEBITO',
  'COMPRA DEBITO',
  'COMPRA CARTAO',
  'DEBITO AUTOMATICO',
  'DEB AUT',
  'PAGTO',
];
const PIX_RE = /^PIX (ENVIADO|RECEBIDO)\b\s*/;

const UFS = new Set(
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '),
);
const COUNTRY = new Set(['BR', 'BRA']);
const CITIES = [
  'SAO PAULO',
  'RIO DE JANEIRO',
  'BELO HORIZONTE',
  'CURITIBA',
  'PORTO ALEGRE',
  'SALVADOR',
  'RECIFE',
  'FORTALEZA',
  'BRASILIA',
  'CAMPINAS',
  'GOIANIA',
  'MANAUS',
  'BELEM',
  'FLORIANOPOLIS',
  'VITORIA',
  'OSASCO',
  'SANTOS',
].map((c) => c.split(' '));

const INSTALLMENT_RE = /\bPARC(?:ELA)?\s*(\d{1,2})\s*(?:\/|DE)\s*(\d{1,2})\b/;
const TRAILING_PAIR_RE = /\s(\d{2})\/(\d{2})$/;

function validInstallment(current: number, total: number) {
  return current >= 1 && current <= total && total <= 24 ? { current, total } : null;
}

function endsWith(tokens: string[], suffix: string[]) {
  if (suffix.length > tokens.length) return false;
  return suffix.every((t, i) => tokens[tokens.length - suffix.length + i] === t);
}

/** Remove ruído do fim (país, UF, cidade, data) sem apagar o nome do estabelecimento. */
function stripTrailingNoise(tokens: string[]): string[] {
  const out = [...tokens];
  let changed = true;
  while (changed) {
    changed = false;
    const last = out.at(-1);
    if (last && (COUNTRY.has(last) || UFS.has(last)) && out.length > 1) {
      out.pop();
      changed = true;
      continue;
    }
    if (last && /^\d{2}\/\d{2}$/.test(last) && out.length > 1) {
      out.pop();
      changed = true;
      continue;
    }
    // Cidade só sai quando sobram ao menos duas palavras: "DROGARIA SAO PAULO" é o nome da loja.
    const city = CITIES.find((c) => endsWith(out, c) && out.length - c.length >= 2);
    if (city) {
      out.splice(out.length - city.length);
      changed = true;
    }
  }
  return out;
}

export function normalize(raw: string): Normalized {
  let text = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

  for (const prefix of BANK_PREFIXES) {
    if (text.startsWith(`${prefix} `) || text === prefix) {
      text = text.slice(prefix.length).trim();
      break;
    }
  }

  const pix = PIX_RE.exec(text);
  if (pix) text = text.slice(pix[0].length).trim();

  let gateway: string | null = null;
  const gw = GATEWAY_RE.exec(text);
  if (gw) {
    gateway = gw[1] ?? null;
    text = text.slice(gw[0].length);
  }

  let installment: Normalized['installment'] = null;
  const parc = INSTALLMENT_RE.exec(text);
  if (parc) {
    installment = validInstallment(Number(parc[1]), Number(parc[2]));
    text = text.replace(parc[0], ' ');
  } else {
    const pair = TRAILING_PAIR_RE.exec(text);
    if (pair) {
      installment = validInstallment(Number(pair[1]), Number(pair[2]));
      text = text.slice(0, pair.index);
    }
  }

  text = text
    .replace(/(\d{2})\/(\d{2})/g, ' $1/$2 ')
    .replace(/[*.,;:!?"'()[\]{}#_|\\]/g, ' ')
    .replace(/(?<!\d)\/|\/(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let tokens = text === '' ? [] : text.split(' ');
  tokens = stripTrailingNoise(tokens).filter(
    (t) => !/^\d{4,}$/.test(t) && !/^\d{2}\/\d{2}$/.test(t),
  );

  const normalized = tokens.join(' ');
  // Em PIX, o que sobra da descrição é o nome da outra pessoa.
  const counterparty = pix && normalized !== '' ? normalized : null;

  return {
    normalized,
    tokens: tokens.filter((t) => t.length >= 2),
    gateway,
    installment,
    counterparty,
  };
}

/** Faixa de valor (absoluto) usada pelo histórico: xs < R$ 50 ≤ sm < R$ 200 ≤ md < R$ 1.000 ≤ lg. */
export function amountBucket(cents: bigint): AmountBucket {
  const abs = cents < 0n ? -cents : cents;
  if (abs < 5000n) return 'xs';
  if (abs < 20000n) return 'sm';
  if (abs < 100000n) return 'md';
  return 'lg';
}
