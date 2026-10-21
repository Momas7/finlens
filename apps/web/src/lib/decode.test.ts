import { describe, expect, it } from 'vitest';
import { decodeText } from './decode';

const buf = (bytes: number[]) => new Uint8Array(bytes).buffer;

describe('decodeText', () => {
  it('UTF-8 com BOM', () => {
    expect(decodeText(buf([0xef, 0xbb, 0xbf, 0x61, 0xc3, 0xa7]))).toBe('aç');
  });

  it('Windows-1252 quando o UTF-8 é inválido', () => {
    expect(decodeText(buf([0x61, 0xe7, 0xe3, 0x6f]))).toBe('ação');
  });

  it('UTF-8 simples', () => {
    expect(decodeText(buf([0x6f, 0x6b]))).toBe('ok');
  });
});
