import { expect, it } from 'vitest';
import { nextTheme } from './theme';

it('ciclo pula a opção que não muda nada visível', () => {
  expect(nextTheme('system', false)).toBe('dark');
  expect(nextTheme('dark', false)).toBe('system');
  expect(nextTheme('system', true)).toBe('light');
  expect(nextTheme('light', true)).toBe('system');
  // Preferência explícita igual ao sistema volta para "system".
  expect(nextTheme('light', false)).toBe('system');
});
