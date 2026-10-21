import { parseBrMoney } from './money';
import { cleanDescription, isoDate, type ParsedRows } from './types';

const HEADER = ['data', 'lancamento', 'categoria', 'tipo', 'valor'];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function isInterCardHeader(header: string[]): boolean {
  return header.length === HEADER.length && header.every((h, i) => fold(h) === HEADER[i]);
}

/** Fatura do cartão Inter: gasto positivo, pagamento negativo; parcela vem na coluna Tipo. */
export function parseInterCard(rows: string[][]): ParsedRows {
  const out: ParsedRows['rows'] = [];
  let ignored = 0;
  for (const [date = '', description = '', , type = '', value = ''] of rows.slice(1)) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
    const postedDate = m ? isoDate(Number(m[3]), Number(m[2]), Number(m[1])) : null;
    const cents = parseBrMoney(value);
    if (!postedDate || cents === null || cents === 0n) {
      ignored++;
      continue;
    }
    const parcel = /Parcela\s+(\d+)\/(\d+)/i.exec(type);
    const suffix = parcel
      ? ` PARC ${parcel[1]?.padStart(2, '0')}/${parcel[2]?.padStart(2, '0')}`
      : '';
    out.push({
      postedDate,
      description: cleanDescription(description + suffix),
      amountCents: -cents,
      externalId: null,
    });
  }
  return { rows: out, ignored };
}
