import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor';

const id = '0b7c9a3e-5c7e-4a43-9d2c-6c0b7b0d2f11';

describe('cursor', () => {
  it('ida e volta', () =>
    expect(decodeCursor(encodeCursor('2026-10-07', id))).toEqual({ postedDate: '2026-10-07', id }));
  it('inválido', () => {
    expect(decodeCursor('@@@')).toBeNull();
    expect(decodeCursor(Buffer.from('2026-13-99|x').toString('base64url'))).toBeNull();
    expect(decodeCursor(encodeCursor('2026-02-31', id))).toBeNull();
  });
});
