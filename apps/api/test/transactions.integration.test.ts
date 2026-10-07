import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

type Node = { id: string; name: string; children: Node[] };

describe('/v1/categories e /v1/transactions', () => {
  let t: TestApp;
  let ana: ReturnType<TestApp['as']>;
  let bia: ReturnType<TestApp['as']>;
  let checking = '';
  let card = '';
  let delivery = '';
  let salary = '';

  const post = (who: typeof ana, payload: object) =>
    who({ method: 'POST', url: '/v1/transactions', payload });

  beforeAll(async () => {
    t = await createTestApp();
    ana = t.as((await t.signUp()).cookie);
    bia = t.as((await t.signUp()).cookie);
    checking = (
      await ana({
        method: 'POST',
        url: '/v1/accounts',
        payload: {
          name: 'Inter',
          type: 'checking',
          openingBalanceCents: '100000',
          openingBalanceDate: '2026-10-01',
        },
      })
    ).json().id;
    card = (
      await ana({
        method: 'POST',
        url: '/v1/accounts',
        payload: { name: 'MP', type: 'credit_card', closingDay: 10, dueDay: 17 },
      })
    ).json().id;
    const tree: Node[] = (await ana({ method: 'GET', url: '/v1/categories' })).json();
    const food = tree.find((n) => n.name === 'Alimentação');
    delivery = food?.children.find((c) => c.name === 'Delivery')?.id ?? '';
    salary =
      tree.find((n) => n.name === 'Receitas')?.children.find((c) => c.name === 'Salário')?.id ?? '';
  });
  afterAll(async () => t?.close());

  it('categorias em árvore', () => {
    expect(delivery).not.toBe('');
    expect(salary).not.toBe('');
  });

  it('cria saída em cartão com statementMonth', async () => {
    const res = await post(ana, {
      accountId: card,
      categoryId: delivery,
      postedDate: '2026-10-15',
      amountCents: '-4590',
      description: 'IFOOD*REST',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      statementMonth: '2026-11-01',
      amountCents: '-4590',
      source: 'manual',
    });
  });

  it.each(['0', '-0', '1234567890123456', '12,5'])('valor inválido %s', async (amount) => {
    const res = await post(ana, {
      accountId: checking,
      postedDate: '2026-10-02',
      amountCents: amount,
      description: 'x',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.fields).toHaveProperty('amountCents');
  });

  it('conta de outro usuário → 404 e nada gravado', async () => {
    const before = (await ana({ method: 'GET', url: '/v1/transactions' })).json().items.length;
    const res = await post(bia, {
      accountId: checking,
      postedDate: '2026-10-02',
      amountCents: '-100',
      description: 'x',
    });
    expect(res.statusCode).toBe(404);
    const after = (await ana({ method: 'GET', url: '/v1/transactions' })).json().items.length;
    expect(after).toBe(before);
  });

  it('categoria de outro usuário → 404', async () => {
    const biaAccount = (
      await bia({
        method: 'POST',
        url: '/v1/accounts',
        payload: { name: 'B', type: 'cash', openingBalanceDate: '2026-10-01' },
      })
    ).json().id;
    const res = await post(bia, {
      accountId: biaAccount,
      categoryId: delivery,
      postedDate: '2026-10-02',
      amountCents: '-100',
      description: 'x',
    });
    expect(res.statusCode).toBe(404);
  });

  it('conta arquivada → 409', async () => {
    const id = (
      await ana({
        method: 'POST',
        url: '/v1/accounts',
        payload: { name: 'Velha', type: 'cash', openingBalanceDate: '2026-10-01' },
      })
    ).json().id;
    await ana({ method: 'DELETE', url: `/v1/accounts/${id}` });
    const res = await post(ana, {
      accountId: id,
      postedDate: '2026-10-02',
      amountCents: '-100',
      description: 'x',
    });
    expect(res.statusCode).toBe(409);
  });

  it('saldo reflete lançamentos', async () => {
    await post(ana, {
      accountId: checking,
      postedDate: '2026-10-02',
      amountCents: '-4590',
      description: 'mercado',
    });
    const accounts = (await ana({ method: 'GET', url: '/v1/accounts' })).json();
    expect(accounts.find((a: { id: string }) => a.id === checking).balanceCents).toBe('95410');
  });

  it('filtros e busca literal', async () => {
    await post(ana, {
      accountId: checking,
      categoryId: salary,
      postedDate: '2026-09-05',
      amountCents: '500000',
      description: 'Salário',
    });
    await post(ana, {
      accountId: checking,
      postedDate: '2026-10-03',
      amountCents: '-100',
      description: '50% off loja',
    });
    await post(ana, {
      accountId: checking,
      postedDate: '2026-10-03',
      amountCents: '-100',
      description: '500 reais',
    });
    const get = async (qs: string) =>
      (await ana({ method: 'GET', url: `/v1/transactions?${qs}` })).json().items;

    expect((await get('q=50%25')).map((i: { description: string }) => i.description)).toEqual([
      '50% off loja',
    ]);
    expect((await get('q=SALÁRIO')).length).toBe(1);
    expect(
      (await get(`accountId=${card}`)).every((i: { accountId: string }) => i.accountId === card),
    ).toBe(true);
    expect((await get(`categoryId=${salary}`)).length).toBe(1);
    expect(
      (await get('from=2026-10-01&to=2026-10-02')).every(
        (i: { postedDate: string }) => i.postedDate <= '2026-10-02' && i.postedDate >= '2026-10-01',
      ),
    ).toBe(true);
    const bad = await ana({ method: 'GET', url: '/v1/transactions?cursor=@@@' });
    expect(bad.statusCode).toBe(400);
  });

  it('paginação sem repetição nem buraco', async () => {
    const t2 = await createTestApp();
    try {
      const who = t2.as((await t2.signUp()).cookie);
      const acc = (
        await who({
          method: 'POST',
          url: '/v1/accounts',
          payload: { name: 'P', type: 'cash', openingBalanceDate: '2026-01-01' },
        })
      ).json().id;
      for (let i = 0; i < 120; i++) {
        const day = i < 60 ? '2026-10-05' : `2026-09-${String((i % 28) + 1).padStart(2, '0')}`;
        await who({
          method: 'POST',
          url: '/v1/transactions',
          payload: { accountId: acc, postedDate: day, amountCents: '-1', description: `t${i}` },
        });
      }
      const seen: { id: string; postedDate: string }[] = [];
      let cursor: string | null = null;
      do {
        const page = (
          await who({ method: 'GET', url: `/v1/transactions${cursor ? `?cursor=${cursor}` : ''}` })
        ).json();
        expect(page.items.length).toBeLessThanOrEqual(50);
        seen.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      expect(new Set(seen.map((s) => s.id)).size).toBe(120);
      const sorted = [...seen].sort((a, b) =>
        a.postedDate === b.postedDate
          ? a.id < b.id
            ? 1
            : -1
          : a.postedDate < b.postedDate
            ? 1
            : -1,
      );
      expect(seen.map((s) => s.id)).toEqual(sorted.map((s) => s.id));
    } finally {
      await t2.close();
    }
  });

  it('editar e excluir', async () => {
    const id = (
      await post(ana, {
        accountId: checking,
        postedDate: '2026-10-04',
        amountCents: '-200',
        description: 'antes',
      })
    ).json().id;
    const patch = await ana({
      method: 'PATCH',
      url: `/v1/transactions/${id}`,
      payload: { description: 'depois', amountCents: '-300' },
    });
    expect(patch.json()).toMatchObject({ description: 'depois', amountCents: '-300' });
    expect((await bia({ method: 'DELETE', url: `/v1/transactions/${id}` })).statusCode).toBe(404);
    expect((await ana({ method: 'DELETE', url: `/v1/transactions/${id}` })).statusCode).toBe(204);
    const ids = (await ana({ method: 'GET', url: '/v1/transactions' }))
      .json()
      .items.map((i: { id: string }) => i.id);
    expect(ids).not.toContain(id);
  });
});
