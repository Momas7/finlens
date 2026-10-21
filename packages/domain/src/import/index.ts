import { parseCsv } from './csv';
import { parseMapped } from './generic';
import { isInterCardHeader, parseInterCard } from './inter';
import { isOfx, parseOfx } from './ofx';
import type { ColumnMapping, ImportRow, ParsedRows } from './types';

export { parseCsv } from './csv';
export { parseBrMoney, parseDecimalMoney } from './money';
export type { ColumnMapping, ImportRow } from './types';

export type ParseImportResult =
  | { kind: 'rows'; format: 'ofx' | 'csv'; rows: ImportRow[]; ignored: number }
  | { kind: 'needs_mapping'; headers: string[]; sample: string[][] }
  | { kind: 'error'; message: string };

function rowsOrError(format: 'ofx' | 'csv', parsed: ParsedRows): ParseImportResult {
  if (parsed.rows.length === 0) {
    return { kind: 'error', message: 'Nenhum lançamento válido encontrado no arquivo.' };
  }
  return { kind: 'rows', format, ...parsed };
}

/** Detecta o formato (OFX, fatura Inter ou CSV com mapeamento) e lê as linhas. */
export function parseImport(text: string, mapping?: ColumnMapping): ParseImportResult {
  if (text.trim() === '') return { kind: 'error', message: 'O arquivo está vazio.' };
  if (isOfx(text)) return rowsOrError('ofx', parseOfx(text));

  const table = parseCsv(text);
  const header = table[0];
  if (!header || table.length < 2) {
    return { kind: 'error', message: 'Não encontrei lançamentos neste arquivo.' };
  }
  if (isInterCardHeader(header)) return rowsOrError('csv', parseInterCard(table));
  if (!mapping) {
    // O mapeamento só aceita as 51 primeiras colunas; células enormes não vão para a tela.
    const cut = (row: string[]) => row.slice(0, 51).map((c) => c.slice(0, 100));
    return { kind: 'needs_mapping', headers: cut(header), sample: table.slice(1, 4).map(cut) };
  }
  return rowsOrError('csv', parseMapped(table, mapping));
}
