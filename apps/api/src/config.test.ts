import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const validEnv = {
  DATABASE_URL: 'postgres://finlens_app:x@localhost:5432/finlens',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  WEB_ORIGIN: 'http://localhost:3000',
};

describe('loadConfig', () => {
  it('aplica defaults', () => {
    expect(loadConfig(validEnv)).toMatchObject({
      databaseUrl: validEnv.DATABASE_URL,
      port: 3333,
      logLevel: 'info',
      isProduction: false,
      authRateLimitPerMinute: 10,
    });
  });

  it('limite de autenticação configurável', () => {
    expect(
      loadConfig({ ...validEnv, AUTH_RATE_LIMIT_PER_MINUTE: '500' }).authRateLimitPerMinute,
    ).toBe(500);
  });

  it('lista variáveis ausentes', () => {
    expect(() => loadConfig({})).toThrow(
      /Configuração inválida: .*DATABASE_URL.*BETTER_AUTH_SECRET/,
    );
  });

  it('rejeita secret curto', () => {
    expect(() => loadConfig({ ...validEnv, BETTER_AUTH_SECRET: 'curto' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });
});
