import { generateDemo, runDemoSeed } from '@finlens/demo-seed';
import { todayInSaoPaulo } from '@finlens/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, injectClient, type TestApp } from './helpers';

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
    expect(kinds).toEqual(
      expect.arrayContaining([
        'duplicate',
        'anomaly',
        'fees',
        'price_increase',
        'new_subscription',
      ]),
    );
    const budgets: { items: { label: string; state: string | null }[] } = await get('/v1/budgets');
    expect(budgets.items.find((i) => i.label === 'Lazer')?.state).toBe('over');
    const goals: { name: string }[] = await get('/v1/goals');
    expect(goals.map((g) => g.name)).toEqual(['Reserva de emergência']);
    const suggestions: { pattern: string }[] = await get('/v1/rule-suggestions');
    expect(suggestions.map((s) => s.pattern)).toContain('PADARIA SAO JOAO');

    const installments: { plans: { label: string; status: string }[] } =
      await get('/v1/installments');
    expect(installments.plans.map((p) => p.label).sort()).toEqual(['Dell', 'Magalu']);
    // As transferências para a Reserva foram ligadas sozinhas, nos dois lados.
    const list: { items: { description: string; transfer: { withAccount: string } | null }[] } =
      await get('/v1/transactions?q=PIX%20TRANSF');
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.every((i) => i.transfer !== null)).toBe(true);

    expect(await runDemoSeed(injectClient(t.app), plan)).toEqual({ created: false });
  });

  it('rótulo inexistente falha antes de criar dados; demo incompleta não passa como pronta', async () => {
    const t2 = await createTestApp({ RATE_LIMIT_PER_MINUTE: '10000' });
    try {
      const good = generateDemo(todayInSaoPaulo());
      const bad = { ...good, budgets: [{ category: 'Inexistente', amountCents: '1000' }] };
      const client = injectClient(t2.app);
      await expect(runDemoSeed(client, bad)).rejects.toThrow(
        /Categoria inexistente na demo: Inexistente/,
      );
      expect((await client('GET', '/v1/accounts')).json).toEqual([]);
      await expect(runDemoSeed(injectClient(t2.app), good)).rejects.toThrow(/incompleta/);
    } finally {
      await t2.close();
    }
  });
});
