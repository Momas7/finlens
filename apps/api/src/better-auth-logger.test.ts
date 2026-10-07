import { describe, expect, it, vi } from 'vitest';
import { betterAuthLogger } from './better-auth-logger';

describe('betterAuthLogger', () => {
  it('repassa o erro ao pino e descarta outros argumentos', () => {
    const calls: unknown[][] = [];
    const fake = {
      error: vi.fn((...a: unknown[]) => calls.push(a)),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
    const err = new Error('falhou');
    betterAuthLogger(fake).log?.('error', 'Failed to create user', err, { password: 'segredo' });
    expect(calls[0]).toEqual([{ component: 'better-auth', err }, 'Failed to create user']);
  });

  it('sem erro não envia err', () => {
    const fake = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
    betterAuthLogger(fake).log?.('warn', 'Invalid password', { email: 'x@example.com' });
    expect(fake.warn).toHaveBeenCalledWith({ component: 'better-auth' }, 'Invalid password');
  });
});
