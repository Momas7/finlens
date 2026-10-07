import { expect, it } from 'vitest';
import { parseId } from './ids';

it('aceita só UUID', () => {
  expect(parseId('0b7c9a3e-5c7e-4a43-9d2c-6c0b7b0d2f11')).toBe(
    '0b7c9a3e-5c7e-4a43-9d2c-6c0b7b0d2f11',
  );
  expect(parseId('../transactions/0b7c9a3e-5c7e-4a43-9d2c-6c0b7b0d2f11')).toBeNull();
  expect(parseId('')).toBeNull();
});
