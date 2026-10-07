import { describe, expect, it } from 'vitest';
import { readStoredTheme, resolveTheme } from './theme';

describe('readStoredTheme', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    ['system', 'system'],
    ['purple', 'system'],
    [null, 'system'],
  ])('%s -> %s', (stored, expected) =>
    expect(readStoredTheme(() => ({ getItem: () => stored }))).toBe(expected),
  );

  it('sem storage -> system', () => expect(readStoredTheme(() => undefined)).toBe('system'));

  it('acesso ao storage que lança -> system', () =>
    expect(
      readStoredTheme(() => {
        throw new Error('SecurityError');
      }),
    ).toBe('system'));

  it('storage que lança -> system', () =>
    expect(
      readStoredTheme(() => ({
        getItem: () => {
          throw new Error('blocked');
        },
      })),
    ).toBe('system'));
});

describe('resolveTheme', () => {
  it('resolve preferência e sistema', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
