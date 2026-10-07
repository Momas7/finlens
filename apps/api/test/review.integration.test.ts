import { classificationFeedback, ensurePersonalWorkspace, withTenant } from '@finlens/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

type Node = { id: string; name: string; children: Node[] };

describe('revisão, confirmação em lote e semelhantes', () => {
  let t: TestApp;
  let ana: ReturnType<TestApp['as']>;
  let anaId = '';
  let bia: ReturnType<TestApp['as']>;
  let account = '';
  const cat: Record<string, string> = {};
  const post = (payload: object, who = ana) =>
    who({
      method: 'POST',
      url: '/v1/transactions',
      payload: { accountId: account, postedDate: '2026-10-05', ...payload },
    });
  const review = async () => (await ana({ method: 'GET', url: '/v1/review' })).json();
  const confirm = (payload: object, who = ana) =>
    who({ method: 'POST', url: '/v1/transactions/confirm', payload });
  const feedbackCount = async () => {
    const { id: workspaceId } = await ensurePersonalWorkspace(t.db, anaId);
    return (
      await withTenant(t.db, { userId: anaId, workspaceId }, (tx) =>
        tx.select().from(classificationFeedback),
      )
    ).length;
  };

  beforeAll(async () => {
    t = await createTestApp();
    const a = await t.signUp();
    anaId = a.userId;
    ana = t.as(a.cookie);
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
  });
  afterAll(async () => t?.close());

  it('agrupa pendentes por chave e sinal, prováveis separados', async () => {
    for (const d of ['2026-10-01', '2026-10-02', '2026-10-03'])
      await post({ amountCents: '-1000', description: 'LOJA NOVA X', postedDate: d });
    await post({ amountCents: '-800', description: 'PADARIA SAO JOAO' });
    await post({ amountCents: '-900', description: 'PADARIA SAO JOAO' });
    await post({ amountCents: '150000', description: 'PIX RECEBIDO MARIA' });
    const r = await review();
    expect(r.counts).toEqual({ needsYou: 4, likely: 2 });
    expect(
      r.needsYou.map((g: { label: string; count: number; sign: string }) => [
        g.label,
        g.count,
        g.sign,
      ]),
    ).toEqual([
      ['LOJA NOVA X', 3, 'out'],
      ['MARIA', 1, 'in'],
    ]);
    expect(r.needsYou[0]).toMatchObject({
      totalCents: '-3000',
      latestDate: '2026-10-03',
      suggestedCategoryId: null,
    });
    expect(r.likely[0]).toMatchObject({
      label: 'PADARIA SAO JOAO',
      count: 2,
      suggestedCategoryId: cat['Alimentação › Padaria'],
    });
  });

  it('lote confirma, gera feedback, deduplica e ignora confirmados iguais', async () => {
    const group = (await review()).needsYou[0];
    const before = await feedbackCount();
    const res = await confirm({
      ids: [...group.transactionIds, group.transactionIds[0]],
      categoryId: cat['Compras › Outras compras'],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ confirmed: 3 });
    expect(await feedbackCount()).toBe(before + 3);
    // Previsão "naquele momento": o lote não pode se usar como histórico.
    const { id: workspaceId } = await ensurePersonalWorkspace(t.db, anaId);
    const rows = await withTenant(t.db, { userId: anaId, workspaceId }, (tx) =>
      tx.select().from(classificationFeedback),
    );
    expect(
      rows
        .filter((r) => r.descriptionNormalized === 'LOJA NOVA X')
        .map((r) => r.predictedCategoryId),
    ).toEqual([null, null, null]);
    const again = await confirm({
      ids: group.transactionIds,
      categoryId: cat['Compras › Outras compras'],
    });
    expect(again.json()).toEqual({ confirmed: 0 });
    expect((await review()).counts.needsYou).toBe(1);
  });

  it('lote com id de outro usuário → 404 e nada muda', async () => {
    const own = (await review()).needsYou[0].transactionIds[0];
    const biaAccount = (
      await bia({
        method: 'POST',
        url: '/v1/accounts',
        payload: { name: 'B', type: 'cash', openingBalanceDate: '2026-10-01' },
      })
    ).json().id;
    const foreign = (
      await post({ accountId: biaAccount, amountCents: '100', description: 'BIA LOJA' }, bia)
    ).json().id;
    expect(foreign).toBeTruthy();
    const res = await confirm({
      ids: [own, foreign],
      categoryId: cat['Receitas › Outras receitas'],
    });
    expect(res.statusCode).toBe(404);
    expect((await review()).counts.needsYou).toBe(1);
  });

  it('categoria incompatível com o sinal → 409; sem categoria → 400', async () => {
    const maria = (await review()).needsYou[0].transactionIds;
    expect(
      (await confirm({ ids: maria, categoryId: cat['Alimentação › Padaria'] })).statusCode,
    ).toBe(409);
    expect((await confirm({ ids: maria })).statusCode).toBe(400);
  });

  it('semelhantes: chave, trigram, sinal e pré-seleção por faixa', async () => {
    await post({
      amountCents: '-2500',
      description: 'AMAZON BR',
      categoryId: cat['Compras › Outras compras'],
    });
    const ref = (await post({ amountCents: '-34990', description: 'AMAZON BR' })).json();
    const md = (await post({ amountCents: '-29900', description: 'AMAZON MKTPLACE PMTS' })).json();
    const xs = (await post({ amountCents: '-3990', description: 'AMAZON BR' })).json();
    const refund = (await post({ amountCents: '5000', description: 'AMAZON BR' })).json();
    await ana({
      method: 'PATCH',
      url: `/v1/transactions/${ref.id}`,
      payload: { categoryId: cat['Compras › Casa e decoração'] },
    });
    const list = (
      await ana({
        method: 'GET',
        url: `/v1/transactions/${ref.id}/similar?categoryId=${cat['Compras › Casa e decoração']}`,
      })
    ).json();
    const byId = Object.fromEntries(
      list.map((i: { transaction: { id: string }; preselected: boolean }) => [
        i.transaction.id,
        i.preselected,
      ]),
    );
    expect(byId[md.id]).toBe(true);
    expect(byId[xs.id]).toBe(false);
    expect(byId).not.toHaveProperty(refund.id);
    expect(byId).not.toHaveProperty(ref.id);
    expect(
      list.every(
        (i: { transaction: { classificationStatus: string } }) =>
          i.transaction.classificationStatus !== 'confirmed',
      ),
    ).toBe(true);

    const near = (
      await post({
        amountCents: '-1000',
        description: 'LOJA DO BAIRRO CENTRO',
        categoryId: cat['Compras › Presentes'],
      })
    ).json();
    const sibling = (
      await post({ amountCents: '-1000', description: 'LOJA DO BAIRRO CENTRAL' })
    ).json();
    const far = (await post({ amountCents: '-1000', description: 'XPTO QWERTY' })).json();
    const nearList = (
      await ana({
        method: 'GET',
        url: `/v1/transactions/${near.id}/similar?categoryId=${cat['Compras › Presentes']}`,
      })
    ).json();
    const ids = nearList.map((i: { transaction: { id: string } }) => i.transaction.id);
    expect(ids).toContain(sibling.id);
    expect(ids).not.toContain(far.id);
  });

  it('semelhantes de descrição vazia → []', async () => {
    const a = (await post({ amountCents: '-100', description: 'PIX ENVIADO' })).json();
    await post({ amountCents: '-200', description: 'PIX ENVIADO' });
    const list = (
      await ana({
        method: 'GET',
        url: `/v1/transactions/${a.id}/similar?categoryId=${cat['Compras › Presentes']}`,
      })
    ).json();
    expect(list).toEqual([]);
  });
});
