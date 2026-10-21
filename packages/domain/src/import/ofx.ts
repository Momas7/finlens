import { parseDecimalMoney } from './money';
import { cleanDescription, isoDate, type ParsedRows } from './types';

export function isOfx(text: string): boolean {
  return /<OFX>|OFXHEADER/i.test(text);
}

function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}>([^<\\r\\n]*)`, 'i').exec(block);
  return (m?.[1] ?? '').trim();
}

/** OFX 1.x (SGML) e 2.x (XML): lê os blocos STMTTRN. */
export function parseOfx(text: string): ParsedRows {
  const blocks = text.matchAll(
    /<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRNRS>|<\/STMTRS>|$)/gi,
  );
  const rows: ParsedRows['rows'] = [];
  let ignored = 0;
  for (const [, block = ''] of blocks) {
    const d = /^(\d{4})(\d{2})(\d{2})/.exec(tag(block, 'DTPOSTED'));
    const postedDate = d ? isoDate(Number(d[1]), Number(d[2]), Number(d[3])) : null;
    const raw = tag(block, 'TRNAMT');
    const amountCents = parseDecimalMoney(
      raw,
      raw.includes(',') && !raw.includes('.') ? 'comma' : 'dot',
    );
    if (!postedDate || amountCents === null || amountCents === 0n) {
      ignored++;
      continue;
    }
    const name = tag(block, 'NAME');
    const memo = tag(block, 'MEMO');
    const description = name && memo && name !== memo ? `${name} ${memo}` : name || memo;
    rows.push({
      postedDate,
      description: cleanDescription(description),
      amountCents,
      externalId: tag(block, 'FITID') || null,
    });
  }
  return { rows, ignored };
}
