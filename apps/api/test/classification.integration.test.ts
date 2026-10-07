import {
  categories,
  classificationFeedback,
  classificationRules,
  ensurePersonalWorkspace,
  withTenant,
} from '@finlens/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

type Node = { id: string; name: string; children: Node[] };

describe('classificação', () => {
  let t: TestApp;
  let ana: ReturnType<TestApp['as']>;
  let anaId = '';
  let account = '';
  const cat: Record<string, string> = {};

  const post = (payload: object) =>
    ana({
      method: 'POST',
      url: '/v1/transactions',
      payload: { accountId: account, postedDate: '2026-10-05', ...payload },
    });
  const classify = (description: string, amountCents: string) =>
    ana({
      method: 'GET',
      url: `/v1/classify?description=${encodeURIComponent(description)}&amountCents=${amountCents}`,
    });

  beforeAll(async () => {
    t = await createTestApp();
    const signed = await t.signUp();
    anaId = signed.userId;
    ana = t.as(signed.cookie);
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

  it('GET /v1/classify sugere sem gravar', async () => {
    const before = (await ana({ method: 'GET', url: '/v1/transactions' })).json().items.length;
    const res = await classify('IFOOD*REST', '-4590');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      categoryId: cat['Alimentação › Delivery'],
      categoryLabel: 'Alimentação › Delivery',
      confidence: 0.9,
      status: 'auto',
      source: 'merchant',
      merchantKey: 'ifood',
      explanation: 'iFood costuma ser Delivery.',
    });
    expect((await ana({ method: 'GET', url: '/v1/transactions' })).json().items.length).toBe(
      before,
    );
  });

  it('POST sem categoria aplica a automática', async () => {
    const res = await post({ amountCents: '-4590', description: 'IFOOD*REST' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      categoryId: cat['Alimentação › Delivery'],
      classificationStatus: 'auto',
      classificationSource: 'merchant',
      classificationConfidence: 0.9,
      merchantKey: 'ifood',
    });
  });

  it('correção ensina o próximo parecido', async () => {
    const first = (await post({ amountCents: '-34990', description: 'AMAZON BR' })).json();
    expect(first.categoryId).toBe(cat['Compras › Outras compras']);
    const fixed = await ana({
      method: 'PATCH',
      url: `/v1/transactions/${first.id}`,
      payload: { categoryId: cat['Compras › Casa e decoração'] },
    });
    expect(fixed.json()).toMatchObject({
      classificationStatus: 'confirmed',
      classificationSource: 'user',
      classificationConfidence: 1,
    });
    const next = (
      await post({ amountCents: '-29900', description: 'AMAZON MKTPLACE PMTS' })
    ).json();
    const { id: workspaceId } = await ensurePersonalWorkspace(t.db, anaId);
    const feedback = await withTenant(t.db, { userId: anaId, workspaceId }, (tx) =>
      tx
        .select()
        .from(classificationFeedback)
        .where(eq(classificationFeedback.transactionId, first.id)),
    );
    expect(feedback).toEqual([
      expect.objectContaining({
        predictedCategoryId: cat['Compras › Outras compras'],
        predictedSource: 'merchant',
        chosenCategoryId: cat['Compras › Casa e decoração'],
        merchantKey: 'amazon',
        amountBucket: 'md',
      }),
    ]);
    expect(next).toMatchObject({
      categoryId: cat['Compras › Casa e decoração'],
      classificationStatus: 'likely',
      classificationSource: 'history',
      classificationConfidence: 0.75,
    });
  });

  it('confirmed não é reclassificado ao editar a descrição', async () => {
    const tx = (
      await post({
        amountCents: '-5000',
        description: 'MERCADO X',
        categoryId: cat['Alimentação › Mercado'],
      })
    ).json();
    expect(tx.classificationStatus).toBe('confirmed');
    const edited = (
      await ana({
        method: 'PATCH',
        url: `/v1/transactions/${tx.id}`,
        payload: { description: 'IFOOD*REST' },
      })
    ).json();
    expect(edited).toMatchObject({
      categoryId: cat['Alimentação › Mercado'],
      classificationStatus: 'confirmed',
    });
  });

  it('descrição vazia após normalizar', async () => {
    const res = await post({ amountCents: '-100', description: 'PIX ENVIADO' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ categoryId: null, classificationStatus: 'none' });
  });

  it('null deixa sem categoria', async () => {
    const res = await post({ amountCents: '-4590', description: 'IFOOD*REST', categoryId: null });
    expect(res.json()).toMatchObject({ categoryId: null, classificationStatus: 'none' });
  });

  it('sugestão abaixo de 0,70 não aplica', async () => {
    // "LOJA NOVA" confirmada em duas categorias diferentes na mesma faixa: conflito.
    await post({
      amountCents: '-1000',
      description: 'LOJA NOVA',
      categoryId: cat['Compras › Roupas'],
    });
    await post({
      amountCents: '-1000',
      description: 'LOJA NOVA',
      categoryId: cat['Compras › Roupas'],
    });
    await post({
      amountCents: '-1000',
      description: 'LOJA NOVA',
      categoryId: cat['Compras › Presentes'],
    });
    await post({
      amountCents: '-1000',
      description: 'LOJA NOVA',
      categoryId: cat['Compras › Presentes'],
    });
    const res = (await post({ amountCents: '-1000', description: 'LOJA NOVA' })).json();
    expect(res.classificationStatus).toBe('suggested');
    expect(res.categoryId).toBeNull();
    expect([cat['Compras › Roupas'], cat['Compras › Presentes']]).toContain(
      res.suggestedCategoryId,
    );
  });

  it('categoria e regra arquivadas são ignoradas', async () => {
    const { id: workspaceId } = await ensurePersonalWorkspace(t.db, anaId);
    const asAna = <T>(fn: Parameters<typeof withTenant<T>>[2]) =>
      withTenant(t.db, { userId: anaId, workspaceId }, fn);
    await asAna((tx) =>
      tx.insert(classificationRules).values({
        workspaceId,
        categoryId: cat['Lazer › Hobbies'] as string,
        pattern: 'LOJA DE PIPAS',
      }),
    );
    expect((await classify('LOJA DE PIPAS', '-3000')).json().categoryId).toBe(
      cat['Lazer › Hobbies'],
    );
    await asAna((tx) =>
      tx
        .update(categories)
        .set({ archivedAt: new Date() })
        .where(eq(categories.id, cat['Lazer › Hobbies'] as string)),
    );
    expect((await classify('LOJA DE PIPAS', '-3000')).json().source).not.toBe('rule');

    await asAna((tx) =>
      tx
        .update(categories)
        .set({ archivedAt: new Date() })
        .where(eq(categories.id, cat['Assinaturas › Música'] as string)),
    );
    const spotify = (await classify('SPOTIFY', '-2190')).json();
    expect(spotify.categoryId).not.toBe(cat['Assinaturas › Música']);
    expect(spotify.status).toBe('none');
  });
});
