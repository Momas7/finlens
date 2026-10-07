import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../categories/default-categories';
import { MERCHANTS, matchMerchant } from './merchants';

describe('MERCHANTS', () => {
  it('tem ao menos 150 estabelecimentos', () =>
    expect(MERCHANTS.length).toBeGreaterThanOrEqual(150));
  it('chaves únicas, padrões sem duplicata e categoria válida', () => {
    const keys = MERCHANTS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    const patterns = MERCHANTS.flatMap((m) => m.patterns);
    expect(new Set(patterns).size).toBe(patterns.length);
    const categoryKeys = new Set(DEFAULT_CATEGORIES.map((c) => c.key));
    for (const m of MERCHANTS) {
      expect(categoryKeys.has(m.categoryKey), `${m.key} → ${m.categoryKey}`).toBe(true);
      for (const p of m.patterns) expect(p).toMatch(/^[A-Z0-9&% ]+$/);
    }
  });
});

describe('matchMerchant', () => {
  it.each([
    ['IFOOD REST', 'ifood'],
    ['UBER TRIP', 'uber'],
    ['UBER EATS PEDIDO', 'uber_eats'],
    ['NETFLIX COM', 'netflix'],
    ['POSTO IPIRANGA', 'ipiranga'],
    ['DROGASIL', 'drogasil'],
    ['AMAZON', 'amazon'],
    ['MERCADOLIVRE', 'mercadolivre'],
    ['STEAM GAMES', 'steam'],
    ['STEAMGAMES COM', 'steam'],
    ['SPOTIFY', 'spotify'],
    ['CARREFOUR COM IND', 'carrefour'],
    ['ACADEMIA SMART FIT', 'smartfit'],
    ['APPLE COM BILL', 'apple'],
    ['GOOGLE YOUTUBEPREMIUM', 'youtube_premium'],
  ])('%s → %s', (normalized, key) => expect(matchMerchant(normalized)?.key).toBe(key));

  it('não casa no meio da palavra', () => expect(matchMerchant('SUBUBER LTDA')).toBeNull());
  it('desconhecido', () => expect(matchMerchant('PADARIA SAO JOAO')).toBeNull());
});
