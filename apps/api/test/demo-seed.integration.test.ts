import { type DemoClient, generateDemo, runDemoSeed } from '@finlens/demo-seed';
import { todayInSaoPaulo } from '@finlens/domain';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

/** Cliente da demo sobre `app.inject`, guardando o cookie de sessão. */
function injectClient(app: FastifyInstance): DemoClient {
  let cookie = '';
  return async (method, url, body) => {
    const res = await app.inject({
      method,
      url,
      payload: body as object | undefined,
      headers: cookie ? { cookie } : {},
    });
    const set = res.headers['set-cookie'];
    if (set) {
      cookie = (Array.isArray(set) ? set : [set]).map((c) => c.split(';')[0]).join('; ');
    }
    return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null };
  };
}

describe('seed da demo', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ RATE_LIMIT_PER_MINUTE: '10000' });
  });
  afterAll(async () => t?.close());

  it('cria a conta demo com conteúdo em todas as telas e é idempotente', async () => {
    const client = injectClient(t.app);
    const plan = generateDemo(todayInSaoPaulo());
    expect(await runDemoSeed(client, plan)).toEqual({ created: true });

    const get = async (path: string) => {
      const res = await client('GET', path);
      expect(res.status).toBe(200);
      return res.json as never;
    };
    const review: { counts: { needsYou: number } } = await get('/v1/review');
    expect(review.counts.needsYou).toBeGreaterThan(0);
    const insights: { items: { kind: string }[] } = await get('/v1/insights');
    const kinds = insights.items.map((i) => i.kind);
    expect(kinds).toEqual(expect.arrayContaining(['duplicate', 'anomaly', 'fees']));
    const budgets: { items: { label: string; state: string | null }[] } = await get('/v1/budgets');
    expect(budgets.items.find((i) => i.label === 'Lazer')?.state).toBe('over');
    const goals: { name: string }[] = await get('/v1/goals');
    expect(goals.map((g) => g.name)).toEqual(['Reserva de emergência']);
    const suggestions: { pattern: string }[] = await get('/v1/rule-suggestions');
    expect(suggestions.map((s) => s.pattern)).toContain('PADARIA SAO JOAO');

    expect(await runDemoSeed(injectClient(t.app), plan)).toEqual({ created: false });
  });
});
