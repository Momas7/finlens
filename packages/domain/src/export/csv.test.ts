import { describe, expect, it } from 'vitest';
import { centsToCsv, csvField, statusLabel, transactionsCsv } from './csv';

describe('CSV de lançamentos', () => {
  it('valor com vírgula decimal e sinal', () => {
    expect(centsToCsv(-123456n)).toBe('-1234,56');
    expect(centsToCsv(5n)).toBe('0,05');
    expect(centsToCsv(-5n)).toBe('-0,05');
  });
  it('escapa separador, aspas e quebra de linha', () => {
    expect(csvField('a;b')).toBe('"a;b"');
    expect(csvField('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvField('a\nb')).toBe('"a\nb"');
    expect(csvField('simples')).toBe('simples');
  });
  it('BOM, cabeçalho e linhas', () => {
    expect(transactionsCsv([])).toBe('﻿data;conta;descrição;valor;categoria;situação\r\n');
    expect(
      transactionsCsv([
        {
          postedDate: '2026-10-05',
          account: 'Inter',
          description: 'CAFE; "BOM"',
          amountCents: -4590n,
          category: null,
          status: 'none',
        },
      ]),
    ).toBe(
      '﻿data;conta;descrição;valor;categoria;situação\r\n2026-10-05;Inter;"CAFE; ""BOM""";-45,90;;sem categoria\r\n',
    );
  });
  it('situação legível', () => {
    expect(['confirmed', 'auto', 'likely', 'suggested', 'none'].map(statusLabel)).toEqual([
      'confirmada',
      'automática',
      'provável',
      'sugestão',
      'sem categoria',
    ]);
  });
});
