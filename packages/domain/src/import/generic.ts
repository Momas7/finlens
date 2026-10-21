import { parseDecimalMoney } from './money';
import { type ColumnMapping, cleanDescription, isoDate, type ParsedRows } from './types';

function parseDate(text: string, format: ColumnMapping['dateFormat']): string | null {
  const t = text.trim().slice(0, 10);
  if (format === 'yyyy-MM-dd') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    return m ? isoDate(Number(m[1]), Number(m[2]), Number(m[3])) : null;
  }
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return null;
  return format === 'dd/MM/yyyy'
    ? isoDate(Number(m[3]), Number(m[2]), Number(m[1]))
    : isoDate(Number(m[3]), Number(m[1]), Number(m[2]));
}

/** CSV de banco desconhecido, com as colunas escolhidas pela pessoa. A primeira linha é o cabeçalho. */
export function parseMapped(rows: string[][], mapping: ColumnMapping): ParsedRows {
  const out: ParsedRows['rows'] = [];
  let ignored = 0;
  for (const row of rows.slice(1)) {
    const postedDate = parseDate(row[mapping.date] ?? '', mapping.dateFormat);
    const cents = parseDecimalMoney(row[mapping.amount] ?? '', mapping.decimal);
    if (!postedDate || cents === null || cents === 0n) {
      ignored++;
      continue;
    }
    out.push({
      postedDate,
      description: cleanDescription(row[mapping.description] ?? ''),
      amountCents: mapping.expenseSign === 'positive' ? -cents : cents,
      externalId: null,
    });
  }
  return { rows: out, ignored };
}
