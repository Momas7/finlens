export type ImportRow = {
  postedDate: string;
  description: string;
  /** Saída negativa. */
  amountCents: bigint;
  /** FITID do OFX, quando houver. */
  externalId: string | null;
};

export type ColumnMapping = {
  date: number;
  description: number;
  amount: number;
  dateFormat: 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'MM/dd/yyyy';
  decimal: 'comma' | 'dot';
  /** Como o gasto aparece no arquivo. */
  expenseSign: 'negative' | 'positive';
};

export type ParsedRows = { rows: ImportRow[]; ignored: number };

const MAX_DESCRIPTION = 140;

export function cleanDescription(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return (clean === '' ? 'Sem descrição' : clean).slice(0, MAX_DESCRIPTION);
}

export function isoDate(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}
