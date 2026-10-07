import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

type Node = { id: string; name: string; kind: string; children: Node[] };

describe('/v1/categories e /v1/classification-rules', () => {
  let t: TestApp;
  let ana: ReturnType<TestApp['as']>;
  let bia: ReturnType<TestApp['as']>;
  const tree = async (who = ana): Promise<Node[]> =>
    (await who({ method: 'GET', url: '/v1/categories' })).json();
  const create = (payload: object, who = ana) =>
    who({ method: 'POST', url: '/v1/categories', payload });

  beforeAll(async () => {
    t = await createTestApp();
    ana = t.as((await t.signUp()).cookie);
    bia = t.as((await t.signUp()).cookie);
  });
  afterAll(async () => t?.close());

  it('cria raiz e filha (filha herda o tipo)', async () => {
    const root = await create({ name: 'Casa' });
    expect(root.statusCode).toBe(201);
    expect(root.json()).toMatchObject({ name: 'Casa', kind: 'expense', children: [] });
    const income = (await tree()).find((n) => n.name === 'Receitas') as Node;
    const child = await create({ name: 'Aluguel recebido', parentId: income.id });
    expect(child.json()).toMatchObject({ name: 'Aluguel recebido', kind: 'income' });
    const reform = await create({ name: 'Reforma', parentId: root.json().id });
    expect(reform.statusCode).toBe(201);
    expect((await tree()).find((n) => n.name === 'Casa')?.children.map((c) => c.name)).toEqual([
      'Reforma',
    ]);
  });

  it('terceiro nível → 409', async () => {
    const casa = (await tree()).find((n) => n.name === 'Casa') as Node;
    const res = await create({ name: 'Pintura', parentId: casa.children[0]?.id });
    expect(res.statusCode).toBe(409);
  });

  it('nome duplicado entre irmãs → 409, sem diferenciar maiúsculas', async () => {
    const res = await create({ name: 'casa' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.fields).toHaveProperty('name');
  });

  it('renomear', async () => {
    const casa = (await tree()).find((n) => n.name === 'Casa') as Node;
    const res = await ana({
      method: 'PATCH',
      url: `/v1/categories/${casa.children[0]?.id}`,
      payload: { name: 'Obras' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Obras');
  });

  it('arquivar raiz arquiva as filhas', async () => {
    const casa = (await tree()).find((n) => n.name === 'Casa') as Node;
    expect((await ana({ method: 'DELETE', url: `/v1/categories/${casa.id}` })).statusCode).toBe(
      204,
    );
    expect((await tree()).find((n) => n.name === 'Casa')).toBeUndefined();
    const child = await create({ name: 'Nova', parentId: casa.id });
    expect(child.statusCode).toBe(409);
    expect((await create({ name: 'Casa' })).statusCode).toBe(201);
  });

  it('categoria de outro usuário → 404', async () => {
    const id = (await tree())[0]?.id;
    expect(
      (await bia({ method: 'PATCH', url: `/v1/categories/${id}`, payload: { name: 'x' } }))
        .statusCode,
    ).toBe(404);
    expect((await bia({ method: 'DELETE', url: `/v1/categories/${id}` })).statusCode).toBe(404);
    expect((await create({ name: 'x', parentId: id }, bia)).statusCode).toBe(404);
  });

  it('regras: criar (normaliza), listar, excluir', async () => {
    const bakery = (await tree())
      .find((n) => n.name === 'Alimentação')
      ?.children.find((c) => c.name === 'Padaria') as Node;
    const res = await ana({
      method: 'POST',
      url: '/v1/classification-rules',
      payload: { categoryId: bakery.id, pattern: 'padaria são joão' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      pattern: 'PADARIA SAO JOAO',
      categoryId: bakery.id,
      categoryLabel: 'Alimentação › Padaria',
    });
    const list = (await ana({ method: 'GET', url: '/v1/classification-rules' })).json();
    expect(list).toHaveLength(1);
    const classified = (
      await ana({
        method: 'GET',
        url: '/v1/classify?description=PADARIA%20SAO%20JOAO&amountCents=-500',
      })
    ).json();
    expect(classified).toMatchObject({ categoryId: bakery.id, source: 'rule', confidence: 0.99 });
    expect(
      (await bia({ method: 'DELETE', url: `/v1/classification-rules/${res.json().id}` }))
        .statusCode,
    ).toBe(404);
    expect(
      (await ana({ method: 'DELETE', url: `/v1/classification-rules/${res.json().id}` }))
        .statusCode,
    ).toBe(204);
    expect((await ana({ method: 'GET', url: '/v1/classification-rules' })).json()).toHaveLength(0);
  });

  it('regra: padrão vazio após normalizar → 400; categoria de outro usuário → 404', async () => {
    const id = (await tree())[0]?.id;
    expect(
      (
        await ana({
          method: 'POST',
          url: '/v1/classification-rules',
          payload: { categoryId: id, pattern: '***' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await bia({
          method: 'POST',
          url: '/v1/classification-rules',
          payload: { categoryId: id, pattern: 'LOJA' },
        })
      ).statusCode,
    ).toBe(404);
  });
});
