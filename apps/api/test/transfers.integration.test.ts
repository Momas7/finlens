import { todayInSaoPaulo } from '@finlens/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

const today = todayInSaoPaulo();
const current = today.slice(0, 7);
const day = Number(today.slice(8));
const dayStr = (n: number) => `${current}-${String(n).padStart(2, '0')}`;
// Datas dentro do mês corrente e já passadas; no dia 1 as duas pontas caem no mesmo dia.
const d1 = dayStr(Math.max(1, day - 1));
const d2 = dayStr(day);

type Tx = {
  id: string;
  categoryId: string | null;
  classificationStatus: string;
  transfer: null | { pairId: string; withAccount: string; kind: string };
};
type Sug = { id: string; kind: string; reason: string; a: { id: string }; b: { id: string } };

describe('transferências e pagamento de fatura', () => {
  let t: TestApp;

  async function setup() {
    const who = t.as((await t.signUp()).cookie);
    const acct = async (name: string, type: string) =>
      (
        await who({
          method: 'POST',
          url: '/v1/accounts',
          payload:
            type === 'credit_card'
              ? { name, type, closingDay: 28, dueDay: 5 }
              : { name, type, openingBalanceDate: '2025-01-01' },
        })
      ).json().id as string;
    const inter = await acct('Inter', 'checking');
    const reserva = await acct('Reserva', 'savings');
    const card = await acct('Cartão MP', 'credit_card');
    const add = async (
      accountId: string,
      amountCents: string,
      description: string,
      postedDate = d2,
    ): Promise<Tx> =>
      (
        await who({
          method: 'POST',
          url: '/v1/transactions',
          payload: { accountId, postedDate, amountCents, description, categoryId: 'auto' },
        })
      ).json();
    const one = async (id: string): Promise<Tx> =>
      (await who({ method: 'GET', url: `/v1/transactions/${id}` })).json();
    const suggestions = async (): Promise<Sug[]> =>
      (await who({ method: 'GET', url: '/v1/transfers/suggestions' })).json();
    return { who, inter, reserva, card, add, one, suggestions };
  }

  beforeAll(async () => {
    t = await createTestApp({ AUTH_RATE_LIMIT_PER_MINUTE: '100' });
  });
  afterAll(async () => t?.close());

  it('liga sozinho ao criar a segunda ponta e tira dos totais', async () => {
    const { who, inter, reserva, add, one } = await setup();
    await who({
      method: 'POST',
      url: '/v1/transactions',
      payload: {
        accountId: inter,
        postedDate: d1,
        amountCents: '800000',
        description: 'SALARIO',
        categoryId: null,
      },
    });
    const out = await add(inter, '-50000', 'PIX RESERVA', d1);
    expect(out.transfer).toBeNull();
    const inn = await add(reserva, '50000', 'PIX RECEBIDO', d2);
    expect(inn.transfer).toMatchObject({ withAccount: 'Inter', kind: 'transfer' });
    const reloaded = await one(out.id);
    expect(reloaded.transfer).toMatchObject({
      withAccount: 'Reserva',
      pairId: inn.transfer?.pairId,
    });
    expect(reloaded).toMatchObject({ classificationStatus: 'confirmed' });
    const summary = (await who({ method: 'GET', url: '/v1/analytics/month' })).json();
    expect(summary.expenseCents).toBe('0');
    expect(summary.incomeCents).toBe('800000');
  });

  it('pagamento de fatura: corrente e cartão', async () => {
    const { inter, card, add } = await setup();
    await add(inter, '-120000', 'PAGAMENTO FATURA MP');
    const credit = await add(card, '120000', 'PAGAMENTO RECEBIDO');
    expect(credit.transfer).toMatchObject({ withAccount: 'Inter', kind: 'card_payment' });
  });

  it('ambíguo vira sugestão; link, dismiss e unlink', async () => {
    const { who, inter, reserva, add, one, suggestions } = await setup();
    const a1 = await add(inter, '-5000', 'PIX');
    const a2 = await add(inter, '-5000', 'PIX');
    const b = await add(reserva, '5000', 'PIX');
    expect((await one(b.id)).transfer).toBeNull();
    const list = await suggestions();
    expect(list).toHaveLength(2);
    expect(list[0]?.id).toMatch(/^[0-9a-f]{16}$/);

    const link = await who({
      method: 'POST',
      url: '/v1/transfers/link',
      payload: { a: a1.id, b: b.id },
    });
    expect(link.statusCode).toBe(204);
    expect((await one(a1.id)).transfer?.withAccount).toBe('Reserva');
    expect(await suggestions()).toEqual([]);
    // ninguém mais liga com quem já tem par
    expect(
      (await who({ method: 'POST', url: '/v1/transfers/link', payload: { a: a2.id, b: b.id } }))
        .statusCode,
    ).toBe(409);

    const unlink = await who({ method: 'POST', url: `/v1/transactions/${a1.id}/unlink` });
    expect(unlink.statusCode).toBe(204);
    expect((await one(a1.id)).transfer).toBeNull();
    expect((await one(b.id)).transfer).toBeNull();
    expect((await one(a1.id)).classificationStatus).not.toBe('confirmed');
    expect(
      (await who({ method: 'POST', url: `/v1/transactions/${a1.id}/unlink` })).statusCode,
    ).toBe(409);

    const [first] = await suggestions();
    expect(
      (await who({ method: 'POST', url: '/v1/transfers/dismiss', payload: { id: first?.id } }))
        .statusCode,
    ).toBe(204);
    expect((await suggestions()).map((s) => s.id)).not.toContain(first?.id);
    expect(
      (await who({ method: 'POST', url: '/v1/transfers/dismiss', payload: { id: first?.id } }))
        .statusCode,
    ).toBe(204);
  });

  it('editar o valor desfaz o par; excluir uma ponta limpa a outra', async () => {
    const { who, inter, reserva, add, one } = await setup();
    const a = await add(inter, '-7000', 'PIX');
    const b = await add(reserva, '7000', 'PIX');
    expect((await one(a.id)).transfer).not.toBeNull();
    await who({
      method: 'PATCH',
      url: `/v1/transactions/${a.id}`,
      payload: { amountCents: '-7100' },
    });
    expect((await one(a.id)).transfer).toBeNull();
    expect((await one(b.id)).transfer).toBeNull();

    const c = await add(inter, '-9000', 'PIX');
    const e = await add(reserva, '9000', 'PIX');
    expect((await one(e.id)).transfer).not.toBeNull();
    await who({ method: 'DELETE', url: `/v1/transactions/${c.id}` });
    expect((await one(e.id)).transfer).toBeNull();
  });

  it('erros e isolamento', async () => {
    const a = await setup();
    const out = await a.add(a.inter, '-3000', 'PIX');
    const same = await a.add(a.inter, '3000', 'PIX');
    const other = await a.add(a.reserva, '3100', 'PIX');
    const link = (x: string, y: string, who = a.who) =>
      who({ method: 'POST', url: '/v1/transfers/link', payload: { a: x, b: y } });
    expect((await link(out.id, same.id)).statusCode).toBe(409); // mesma conta
    expect((await link(out.id, other.id)).statusCode).toBe(409); // valores diferentes
    const b = await setup();
    expect((await link(out.id, other.id, b.who)).statusCode).toBe(404);
    expect(await b.suggestions()).toEqual([]);
    expect(
      (await b.who({ method: 'POST', url: `/v1/transactions/${out.id}/unlink` })).statusCode,
    ).toBe(404);
  });

  it('sem pares, nada a sugerir; revisão conta as sugestões', async () => {
    const { who, inter, reserva, add, suggestions } = await setup();
    expect(await suggestions()).toEqual([]);
    expect((await who({ method: 'GET', url: '/v1/review' })).json().counts.transfers).toBe(0);
    await add(inter, '-4000', 'ENVIO');
    await add(reserva, '4000', 'ENTRADA');
    expect(await suggestions()).toHaveLength(1);
    expect((await who({ method: 'GET', url: '/v1/review' })).json().counts.transfers).toBe(1);
  });
});
