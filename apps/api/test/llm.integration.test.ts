import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

type Cat = { id: string; name: string; kind: string; children: Cat[] };

describe('LLM opcional', () => {
  let fake: Server;
  let baseUrl = '';
  let reply: (req: { body: string }) => { status?: number; content?: string; hang?: boolean };
  const received: string[] = [];
  let on: TestApp;
  let off: TestApp;
  let ana: ReturnType<TestApp['as']>;
  let bia: ReturnType<TestApp['as']>;
  let offUser: ReturnType<TestApp['as']>;
  let account = '';
  let out: string;

  const answer = (category: string | null, confidence = 0.7) => ({
    content: JSON.stringify({ category, confidence }),
  });
  const create = (who: typeof ana, acc: string, payload: object) =>
    who({
      method: 'POST',
      url: '/v1/transactions',
      payload: { accountId: acc, postedDate: '2026-10-05', ...payload },
    });
  const suggest = (who: typeof ana, transactionId: string) =>
    who({ method: 'POST', url: '/v1/llm/suggest', payload: { transactionId } });
  const tx = async (who: typeof ana, acc: string, description: string, amountCents: string) =>
    ((await create(who, acc, { description, amountCents })).json() as { id: string }).id;
  const label = async (who: typeof ana, name: string) => {
    const tree = (await who({ method: 'GET', url: '/v1/categories' })).json() as Cat[];
    const root = tree.find((c) => c.children.some((k) => k.name === name));
    return `${root?.name} › ${name}`;
  };

  beforeAll(async () => {
    fake = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => {
        body += c;
      });
      req.on('end', () => {
        received.push(body);
        const r = reply({ body });
        if (r.hang) return;
        res.writeHead(r.status ?? 200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: r.content ?? '' } }] }));
      });
    });
    await new Promise<void>((ok) => fake.listen(0, '127.0.0.1', ok));
    baseUrl = `http://127.0.0.1:${(fake.address() as AddressInfo).port}/v1`;

    on = await createTestApp({
      LLM_BASE_URL: baseUrl,
      LLM_MODEL: 'fake',
      LLM_TIMEOUT_MS: '400',
      AUTH_RATE_LIMIT_PER_MINUTE: '100',
    });
    off = await createTestApp();
    ana = on.as((await on.signUp()).cookie);
    bia = on.as((await on.signUp()).cookie);
    offUser = off.as((await off.signUp()).cookie);
    const acc = async (who: typeof ana) =>
      (
        (
          await who({
            method: 'POST',
            url: '/v1/accounts',
            payload: { name: 'Conta', type: 'checking', openingBalanceDate: '2026-10-01' },
          })
        ).json() as { id: string }
      ).id;
    account = await acc(ana);
    out = await tx(ana, account, 'XPTO ESTRANHO 123456', '-4590');
  });

  afterAll(async () => {
    await on.close();
    await off.close();
    await new Promise((ok) => fake.close(ok));
  });

  it('status reflete a configuração', async () => {
    expect((await ana({ method: 'GET', url: '/v1/llm/status' })).json()).toEqual({ enabled: true });
    expect((await offUser({ method: 'GET', url: '/v1/llm/status' })).json()).toEqual({
      enabled: false,
    });
  });

  it('desligado: 404 e nenhuma chamada', async () => {
    const before = received.length;
    const acc = (
      (
        await offUser({
          method: 'POST',
          url: '/v1/accounts',
          payload: { name: 'C', type: 'checking', openingBalanceDate: '2026-10-01' },
        })
      ).json() as { id: string }
    ).id;
    const id = await tx(offUser, acc, 'ALGO', '-100');
    expect((await suggest(offUser, id)).statusCode).toBe(404);
    expect(received.length).toBe(before);
  });

  it('sugestão válida devolve a categoria e o prompt não tem valor, data nem id', async () => {
    const market = await label(ana, 'Mercado');
    reply = () => answer(market, 0.9);
    const res = await suggest(ana, out);
    expect(res.statusCode).toBe(200);
    const body = res.json() as { categoryId: string; label: string; confidence: number };
    expect(body.label).toBe(market);
    expect(body.confidence).toBe(0.8);
    const sent = received.at(-1) ?? '';
    expect(sent).toContain('XPTO ESTRANHO');
    expect(sent).not.toMatch(/45[,.]?90|4590|2026-10|123456/);
    expect(sent).not.toContain(out);
    expect(sent).not.toContain(account);
    expect(JSON.parse(sent).temperature).toBe(0);
  });

  it('categoria fora da lista, de outro tipo ou JSON quebrado: sem sugestão', async () => {
    const wrong = [
      answer('Categoria Inventada').content,
      answer('Movimentação › Transferência entre contas').content,
      answer(await label(ana, 'Salário')).content, // receita numa saída
      'isso não é json',
    ];
    for (const [i, content] of wrong.entries()) {
      const id = await tx(ana, account, `LOJA ESQUISITA ${'ABCD'[i]}`, '-1000');
      reply = () => ({ content });
      const res = await suggest(ana, id);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ categoryId: null });
    }
  });

  it('servidor lento ou com erro: sem erro para a pessoa', async () => {
    const slow = await tx(ana, account, 'DEMORADO LTDA', '-1000');
    reply = () => ({ hang: true });
    const res = await suggest(ana, slow);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ categoryId: null });
    const broken = await tx(ana, account, 'QUEBRADO LTDA', '-1000');
    reply = () => ({ status: 500 });
    expect((await suggest(ana, broken)).json()).toEqual({ categoryId: null });
  });

  it('descrição normalizada vazia: sem chamada', async () => {
    const id = await tx(ana, account, '123456789', '-1000');
    const before = received.length;
    reply = () => answer(null);
    expect((await suggest(ana, id)).json()).toEqual({ categoryId: null });
    expect(received.length).toBe(before);
  });

  it('cache por workspace e sentido', async () => {
    const market = await label(ana, 'Mercado');
    const a = await tx(ana, account, 'CACHE TESTE UNICO', '-1000');
    const b = await tx(ana, account, 'CACHE TESTE UNICO', '-2000');
    reply = () => answer(market, 0.6);
    await suggest(ana, a);
    const n = received.length;
    const second = await suggest(ana, b);
    expect(second.statusCode).toBe(200);
    expect(received.length).toBe(n); // mesmo texto e sentido: cache

    // Entrada com o mesmo texto: sentido diferente, nova chamada.
    const salary = await label(ana, 'Salário');
    reply = () => answer(salary, 0.6);
    const inc = await tx(ana, account, 'CACHE TESTE UNICO', '5000');
    const incRes = (await suggest(ana, inc)).json() as { label: string };
    expect(received.length).toBe(n + 1);
    expect(incRes.label).toBe(salary);

    // Outro workspace com o mesmo texto: nova chamada.
    const accB = (
      (
        await bia({
          method: 'POST',
          url: '/v1/accounts',
          payload: { name: 'C', type: 'checking', openingBalanceDate: '2026-10-01' },
        })
      ).json() as { id: string }
    ).id;
    const other = await tx(bia, accB, 'CACHE TESTE UNICO', '-1000');
    reply = () => answer(market, 0.6);
    await suggest(bia, other);
    expect(received.length).toBe(n + 2);
  });

  it('lançamento de outro workspace ou inexistente: 404', async () => {
    expect((await suggest(bia, out)).statusCode).toBe(404);
    expect((await suggest(ana, '00000000-0000-4000-8000-000000000000')).statusCode).toBe(404);
  });
});
