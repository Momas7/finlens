import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

type Node = { id: string; name: string; children: Node[] };

describe('/v1/rule-suggestions', () => {
  let t: TestApp;
  let ana: ReturnType<TestApp['as']>;
  let bia: ReturnType<TestApp['as']>;
  let account = '';
  const cat: Record<string, string> = {};
  const suggestions = async (who = ana) =>
    (await who({ method: 'GET', url: '/v1/rule-suggestions' })).json();

  beforeAll(async () => {
    t = await createTestApp();
    ana = t.as((await t.signUp()).cookie);
    bia = t.as((await t.signUp()).cookie);
    account = (
      await ana({
        method: 'POST',
        url: '/v1/accounts',
        payload: { name: 'Inter', type: 'checking', openingBalanceDate: '2026-10-01' },
      })
    ).json().id;
    const tree: Node[] = (await ana({ method: 'GET', url: '/v1/categories' })).json();
    for (const root of tree) {
      cat[root.name] = root.id;
      for (const child of root.children) cat[`${root.name} › ${child.name}`] = child.id;
    }
    for (let i = 0; i < 3; i++) {
      await ana({
        method: 'POST',
        url: '/v1/transactions',
        payload: {
          accountId: account,
          postedDate: '2026-10-05',
          amountCents: '-1250',
          description: 'PADARIA SAO JOAO',
          categoryId: cat['Alimentação › Padaria'],
        },
      });
    }
  });
  afterAll(async () => t?.close());

  it('sugere regra após 3 confirmações consistentes', async () => {
    expect(await suggestions()).toEqual([
      expect.objectContaining({
        pattern: 'PADARIA SAO JOAO',
        categoryId: cat['Alimentação › Padaria'],
        categoryLabel: 'Alimentação › Padaria',
        minAmountCents: null,
        maxAmountCents: null,
        basedOn: 3,
        id: expect.stringMatching(/^[0-9a-f]{16}$/),
      }),
    ]);
  });

  it('outro usuário não vê', async () => expect(await suggestions(bia)).toEqual([]));

  it('dispensar remove e não volta', async () => {
    const [s] = await suggestions();
    expect(
      (await ana({ method: 'POST', url: '/v1/rule-suggestions/dismiss', payload: { id: s.id } }))
        .statusCode,
    ).toBe(204);
    expect(await suggestions()).toEqual([]);
    expect(
      (await ana({ method: 'POST', url: '/v1/rule-suggestions/dismiss', payload: { id: s.id } }))
        .statusCode,
    ).toBe(204);
  });

  it('regra criada some da sugestão; categoria arquivada não é sugerida', async () => {
    for (let i = 0; i < 3; i++) {
      await ana({
        method: 'POST',
        url: '/v1/transactions',
        payload: {
          accountId: account,
          postedDate: '2026-10-06',
          amountCents: '-3000',
          description: 'ACOUGUE BOI GORDO',
          categoryId: cat['Alimentação › Mercado'],
        },
      });
      await ana({
        method: 'POST',
        url: '/v1/transactions',
        payload: {
          accountId: account,
          postedDate: '2026-10-06',
          amountCents: '-4000',
          description: 'BANCA DO ZE',
          categoryId: cat['Lazer › Hobbies'],
        },
      });
    }
    const patterns = (await suggestions()).map((s: { pattern: string }) => s.pattern);
    expect(patterns).toEqual(expect.arrayContaining(['ACOUGUE BOI GORDO', 'BANCA DO ZE']));
    await ana({
      method: 'POST',
      url: '/v1/classification-rules',
      payload: { categoryId: cat['Alimentação › Mercado'], pattern: 'ACOUGUE BOI GORDO' },
    });
    await ana({ method: 'DELETE', url: `/v1/categories/${cat['Lazer › Hobbies']}` });
    expect((await suggestions()).map((s: { pattern: string }) => s.pattern)).toEqual([]);
  });

  it('id inválido na dispensa → 400', async () =>
    expect(
      (await ana({ method: 'POST', url: '/v1/rule-suggestions/dismiss', payload: { id: 'x' } }))
        .statusCode,
    ).toBe(400));
});
