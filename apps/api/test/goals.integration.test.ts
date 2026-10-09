import { ensurePersonalWorkspace, goals, withTenant } from '@finlens/db';
import { addMonths, monthsBetween, previousMonth, todayInSaoPaulo } from '@finlens/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

const today = todayInSaoPaulo();
const current = today.slice(0, 7);
const nextYear = Number(current.slice(0, 4)) + 1;
const targetDate = `${nextYear}-12-15`;
const monthsAgo = (n: number) => {
  let m = current;
  for (let i = 0; i < n; i++) m = previousMonth(m);
  return m;
};

describe('/v1/goals', () => {
  let t: TestApp;

  async function setup() {
    const signed = await t.signUp();
    const who = t.as(signed.cookie);
    const account = async (type = 'savings', opening = '200000') =>
      (
        await who({
          method: 'POST',
          url: '/v1/accounts',
          payload:
            type === 'credit_card'
              ? { name: 'Cartão', type, closingDay: 10, dueDay: 17 }
              : {
                  name: 'Reserva',
                  type,
                  openingBalanceCents: opening,
                  openingBalanceDate: '2025-01-01',
                },
        })
      ).json().id as string;
    const reserve = await account();
    const create = (payload: object) => who({ method: 'POST', url: '/v1/goals', payload });
    const list = async (query = '') =>
      (await who({ method: 'GET', url: `/v1/goals${query}` })).json();
    const deposit = (amountCents: string, postedDate: string) =>
      who({
        method: 'POST',
        url: '/v1/transactions',
        payload: { accountId: reserve, postedDate, amountCents, description: 'DEPOSITO RESERVA' },
      });
    const { id: workspaceId } = await ensurePersonalWorkspace(t.db, signed.userId);
    const asOwner = <T>(fn: Parameters<typeof withTenant<T>>[2]) =>
      withTenant(t.db, { userId: signed.userId, workspaceId }, fn);
    return { who, account, reserve, create, list, deposit, asOwner };
  }

  beforeAll(async () => {
    t = await createTestApp({ AUTH_RATE_LIMIT_PER_MINUTE: '100' });
  });
  afterAll(async () => t?.close());

  it('cria e lista', async () => {
    const { reserve, create, list } = await setup();
    const res = await create({
      name: 'Viagem',
      targetCents: '1000000',
      accountId: reserve,
      targetDate,
    });
    expect(res.statusCode).toBe(201);
    const [goal] = await list();
    const months = monthsBetween(current, `${nextYear}-12`);
    expect(goal).toMatchObject({
      name: 'Viagem',
      accountName: 'Reserva',
      balanceCents: '200000',
      progress: 0.2,
      remainingCents: '800000',
      // Conta aberta em 2025 sem movimento: ritmo zero (não nulo) e sem previsão.
      monthlyPaceCents: '0',
      projectedMonth: null,
      status: 'no_pace',
      requiredMonthlyCents: String(Math.ceil(800000 / months)),
      annualRatePercent: null,
      archived: false,
    });
  });

  it('ritmo e previsão', async () => {
    const { reserve, create, list, deposit } = await setup();
    for (let n = 3; n >= 1; n--) await deposit('50000', `${monthsAgo(n)}-05`);
    await create({ name: 'Viagem', targetCents: '1000000', accountId: reserve });
    const [goal] = await list();
    expect(goal).toMatchObject({
      balanceCents: '350000',
      monthlyPaceCents: '50000',
      projectedMonth: addMonths(current, 13),
      status: 'no_date',
    });
  });

  it('taxa reduz o aporte necessário', async () => {
    const a = await setup();
    await a.create({ name: 'Sem taxa', targetCents: '1000000', accountId: a.reserve, targetDate });
    const b = await setup();
    await b.create({
      name: 'Com taxa',
      targetCents: '1000000',
      accountId: b.reserve,
      targetDate,
      annualRatePercent: '10,5',
    });
    const [plain] = await a.list();
    const [rated] = await b.list();
    expect(rated.annualRatePercent).toBe('10,50');
    expect(BigInt(rated.requiredMonthlyCents)).toBeLessThan(BigInt(plain.requiredMonthlyCents));
  });

  it('alterar e concluir; limpar data', async () => {
    const { who, reserve, create, list } = await setup();
    const id = (
      await create({ name: 'Viagem', targetCents: '1000000', accountId: reserve, targetDate })
    ).json().id;
    const patch = (payload: object) => who({ method: 'PATCH', url: `/v1/goals/${id}`, payload });
    expect((await patch({ targetCents: '150000' })).statusCode).toBe(200);
    expect((await list())[0]).toMatchObject({ status: 'done', remainingCents: '0', progress: 1 });
    await patch({ targetDate: null, targetCents: '900000' });
    expect((await list())[0]).toMatchObject({
      targetDate: null,
      requiredMonthlyCents: null,
      status: 'no_date',
    });
  });

  it('data que já passou: aporte nulo e editar sem mudar a data funciona', async () => {
    const { who, reserve, create, list, asOwner } = await setup();
    const id = (
      await create({ name: 'Viagem', targetCents: '1000000', accountId: reserve, targetDate })
    ).json().id;
    const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000)
      .toISOString()
      .slice(0, 10);
    await asOwner((tx) => tx.update(goals).set({ targetDate: yesterday }));
    expect((await list())[0]).toMatchObject({ targetDate: yesterday, requiredMonthlyCents: null });
    const res = await who({
      method: 'PATCH',
      url: `/v1/goals/${id}`,
      payload: { name: 'Viagem longa', targetCents: '1200000', targetDate: yesterday },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: 'Viagem longa', targetDate: yesterday });
  });

  it('arquivar libera a conta', async () => {
    const { who, reserve, create, list } = await setup();
    const id = (await create({ name: 'Viagem', targetCents: '1000000', accountId: reserve })).json()
      .id;
    expect((await who({ method: 'DELETE', url: `/v1/goals/${id}` })).statusCode).toBe(204);
    expect(
      (await create({ name: 'Casa', targetCents: '5000000', accountId: reserve })).statusCode,
    ).toBe(201);
    expect((await list()).map((g: { name: string }) => g.name)).toEqual(['Casa']);
    expect((await list('?archived=true')).map((g: { name: string }) => g.name).sort()).toEqual([
      'Casa',
      'Viagem',
    ]);
  });

  it('erros', async () => {
    const a = await setup();
    const card = await a.account('credit_card');
    expect((await a.create({ name: 'X', targetCents: '1000', accountId: card })).statusCode).toBe(
      409,
    );
    await a.create({ name: 'X', targetCents: '1000', accountId: a.reserve });
    expect(
      (await a.create({ name: 'Y', targetCents: '1000', accountId: a.reserve })).statusCode,
    ).toBe(409);
    const b = await setup();
    expect(
      (await b.create({ name: 'X', targetCents: '1000', accountId: a.reserve })).statusCode,
    ).toBe(404);
    const other = await b.account();
    const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(
      (await b.create({ name: 'X', targetCents: '1000', accountId: other, targetDate: yesterday }))
        .statusCode,
    ).toBe(400);
    expect((await b.create({ name: 'X', targetCents: '0', accountId: other })).statusCode).toBe(
      400,
    );
    expect(
      (
        await b.create({
          name: 'X',
          targetCents: '1000',
          accountId: other,
          annualRatePercent: '101',
        })
      ).statusCode,
    ).toBe(400);
    const [goalA] = await a.list();
    expect(
      (await b.who({ method: 'PATCH', url: `/v1/goals/${goalA.id}`, payload: { name: 'Z' } }))
        .statusCode,
    ).toBe(404);
    expect((await b.who({ method: 'DELETE', url: `/v1/goals/${goalA.id}` })).statusCode).toBe(404);
  });

  it('conta arquivada mantém a meta; lançamento futuro entra no saldo', async () => {
    const { who, reserve, create, list, deposit } = await setup();
    await create({ name: 'Viagem', targetCents: '1000000', accountId: reserve });
    await deposit('10000', `${current}-28`);
    await who({ method: 'DELETE', url: `/v1/accounts/${reserve}` });
    expect((await list())[0]).toMatchObject({ name: 'Viagem', balanceCents: '210000' });
  });
});
