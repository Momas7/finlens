import { describe, expect, it } from 'vitest';
import { parseBrMoney, parseCsv, parseDecimalMoney, parseImport } from './index';

const HEADER = '"Data","Lançamento","Categoria","Tipo","Valor"\n';
const INTER = `﻿"Data","Lançamento","Categoria","Tipo","Valor"
"20/10/2026","MIX MATEUS","COMPRAS","Parcela 1/2","R$ 64,38"
"18/10/2026","MARIPOSA VILAS         LAURO DE FREI BRA","RESTAURANTES","Compra à vista","R$ 42,76"
"12/10/2026","PAGAMENTO ON LINE","OUTROS","Compra à vista","-R$ 217,50"
"09/10/2026","PAGAMENTO ON LINE","OUTROS","Compra à vista","-R$ 1.267,64"
"31/02/2026","DATA RUIM","OUTROS","Compra à vista","R$ 1,00"
"05/10/2026","SEM VALOR","OUTROS","Compra à vista","abc"
`;

describe('dinheiro', () => {
  it('lê formatos brasileiros', () => {
    expect(parseBrMoney('R$ 1.267,64')).toBe(126764n);
    expect(parseBrMoney('-R$ 217,50')).toBe(-21750n);
    expect(parseBrMoney('R$ -217,50')).toBe(-21750n);
    expect(parseBrMoney('1267,6')).toBe(126760n);
    expect(parseBrMoney('42')).toBe(4200n);
    expect(parseBrMoney('abc')).toBeNull();
    expect(parseBrMoney('1.2.3,00')).toBeNull();
    expect(parseBrMoney('')).toBeNull();
  });

  it('lê ponto decimal', () => {
    expect(parseDecimalMoney('-45.90', 'dot')).toBe(-4590n);
    expect(parseDecimalMoney('1,234.56', 'dot')).toBe(123456n);
  });
});

describe('parseCsv', () => {
  it('remove BOM, respeita aspas e detecta ponto e vírgula', () => {
    expect(parseCsv('﻿a;b\n"x;1";"diz ""oi"""\n\n')).toEqual([
      ['a', 'b'],
      ['x;1', 'diz "oi"'],
    ]);
  });

  it('aceita vírgula e CRLF', () => {
    expect(parseCsv('a,b\r\n1,"2,5"\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2,5'],
    ]);
  });
});

describe('fatura do cartão Inter', () => {
  const result = parseImport(INTER);

  it('lê gastos como saída, pagamentos como entrada e ignora o que não vale', () => {
    expect(result.kind).toBe('rows');
    if (result.kind !== 'rows') return;
    expect(result.format).toBe('csv');
    expect(result.ignored).toBe(2);
    expect(result.rows).toEqual([
      {
        postedDate: '2026-10-20',
        description: 'MIX MATEUS PARC 01/02',
        amountCents: -6438n,
        externalId: null,
      },
      {
        postedDate: '2026-10-18',
        description: 'MARIPOSA VILAS LAURO DE FREI BRA',
        amountCents: -4276n,
        externalId: null,
      },
      {
        postedDate: '2026-10-12',
        description: 'PAGAMENTO ON LINE',
        amountCents: 21750n,
        externalId: null,
      },
      {
        postedDate: '2026-10-09',
        description: 'PAGAMENTO ON LINE',
        amountCents: 126764n,
        externalId: null,
      },
    ]);
  });
});

describe('pagamento da fatura do Inter', () => {
  it('vira entrada mesmo quando o banco exporta o valor positivo', () => {
    const csv = `${HEADER}"09/10/2026","PAGAMENTO ON LINE","OUTROS","Compra à vista","R$ 1.267,64"\n"08/10/2026","LOJA X","COMPRAS","Compra à vista","R$ 5,00"\n`;
    const result = parseImport(csv);
    expect(result.kind).toBe('rows');
    if (result.kind !== 'rows') return;
    expect(result.rows.map((r) => r.amountCents)).toEqual([126764n, -500n]);
  });
});

describe('OFX', () => {
  const sgml = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261005120000[-3:BRT]
<TRNAMT>-45.90
<FITID>abc123
<NAME>PADARIA SAO JOAO
<MEMO>COMPRA DEBITO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261006
<TRNAMT>1200,50
<FITID>abc124
<MEMO>SALARIO
</STMTTRN>
<STMTTRN>
<DTPOSTED>20261007
<TRNAMT>0
<FITID>abc125
<MEMO>ZERO
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

  it('lê FITID, sinal, vírgula decimal e NAME/MEMO', () => {
    const result = parseImport(sgml);
    expect(result).toMatchObject({ kind: 'rows', format: 'ofx', ignored: 1 });
    if (result.kind !== 'rows') return;
    expect(result.rows).toEqual([
      {
        postedDate: '2026-10-05',
        description: 'PADARIA SAO JOAO COMPRA DEBITO',
        amountCents: -4590n,
        externalId: 'abc123',
      },
      {
        postedDate: '2026-10-06',
        description: 'SALARIO',
        amountCents: 120050n,
        externalId: 'abc124',
      },
    ]);
  });

  it('OFX em XML com tags fechadas', () => {
    const xml =
      '<OFX><STMTTRN><DTPOSTED>20261005</DTPOSTED><TRNAMT>-10.00</TRNAMT><FITID>1</FITID><MEMO>X</MEMO></STMTTRN></OFX>';
    const result = parseImport(xml);
    expect(result).toMatchObject({ kind: 'rows' });
    if (result.kind === 'rows') expect(result.rows[0]?.amountCents).toBe(-1000n);
  });
});

describe('CSV genérico', () => {
  const csv = 'dia;historico;valor\n05/10/2026;Padaria;45,90\n06/10/2026;Salário;-1.200,00\n';

  it('pede mapeamento quando o cabeçalho é desconhecido', () => {
    expect(parseImport(csv)).toEqual({
      kind: 'needs_mapping',
      headers: ['dia', 'historico', 'valor'],
      sample: [
        ['05/10/2026', 'Padaria', '45,90'],
        ['06/10/2026', 'Salário', '-1.200,00'],
      ],
    });
  });

  it('aplica o mapeamento; gasto positivo vira saída', () => {
    const result = parseImport(csv, {
      date: 0,
      description: 1,
      amount: 2,
      dateFormat: 'dd/MM/yyyy',
      decimal: 'comma',
      expenseSign: 'positive',
    });
    expect(result).toMatchObject({ kind: 'rows', format: 'csv', ignored: 0 });
    if (result.kind !== 'rows') return;
    expect(result.rows.map((r) => [r.postedDate, r.amountCents])).toEqual([
      ['2026-10-05', -4590n],
      ['2026-10-06', 120000n],
    ]);
  });

  it('mm/dd/aaaa e aaaa-mm-dd', () => {
    const base = {
      date: 0,
      description: 1,
      amount: 2,
      decimal: 'dot',
      expenseSign: 'negative',
    } as const;
    const us = parseImport('d,h,v\n10/05/2026,X,-1.50\n', { ...base, dateFormat: 'MM/dd/yyyy' });
    const iso = parseImport('d,h,v\n2026-10-05,X,-1.50\n', { ...base, dateFormat: 'yyyy-MM-dd' });
    for (const r of [us, iso]) {
      expect(r.kind).toBe('rows');
      if (r.kind === 'rows')
        expect(r.rows[0]).toMatchObject({ postedDate: '2026-10-05', amountCents: -150n });
    }
  });
});

describe('erros', () => {
  it('vazio, sem linhas e sem lançamentos válidos', () => {
    expect(parseImport('  \n')).toMatchObject({ kind: 'error' });
    expect(parseImport('a;b\n')).toMatchObject({ kind: 'error' });
    const mapping = {
      date: 0,
      description: 1,
      amount: 2,
      dateFormat: 'dd/MM/yyyy',
      decimal: 'comma',
      expenseSign: 'negative',
    } as const;
    expect(parseImport('a;b;c\nx;y;z\n', mapping)).toMatchObject({ kind: 'error' });
  });
});
