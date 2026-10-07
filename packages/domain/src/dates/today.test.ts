import { expect, it } from 'vitest';
import { todayInSaoPaulo } from './today';

it('todayInSaoPaulo usa o fuso', () =>
  expect(todayInSaoPaulo(new Date('2026-10-08T02:30:00Z'))).toBe('2026-10-07'));
