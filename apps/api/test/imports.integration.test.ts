import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers';

type Who = ReturnType<TestApp['as']>;
type Tx = {
  id: string;
  description: string;
  amountCents: string;
  source: string;
  statementMonth: string | null;
  classificationStatus: string;
  categoryId: string | null;
  transfer: unknown;
};

const HEADER = '"Data","Lançamento","Categoria","Tipo","Valor"\n';
const line = (date: string, desc: string, type: string, value: string) =>
  `"${date}","${desc}","OUTROS","${type}","${value}"\n`;

describe('importação de extratos', () => {
  let t: TestApp;
  let ana: Who;
  let bia: Who;
  let card = '';
  let checking = '';

  const mkAccount = async (who: Who, payload: object) =>
    ((await who({ method: 'POST', url: '/v1/accounts', payload })).json() as { id: string }).id;
  const preview = (who: Who, accountId: string, content: string, extra: object = {}) =>
    who({
      method: 'POST',
      url: '/v1/imports/preview',
      payload: { accountId, filename: 'extrato.csv', content, ...extra },
    });
  const commit = (who: Who, id: string) => who({ method: 'POST', url: `/v1/imports/${id}/commit` });
  const list = async (who: Who, accountId: string): Promise<Tx[]> =>
    (
      (await who({ method: 'GET', url: `/v1/transactions?accountId=${accountId}` })).json() as {
        items: Tx[];
      }
    ).items;

  beforeAll(async () => {
    t = await createTestApp({ AUTH_RATE_LIMIT_PER_MINUTE: '100' });
    ana = t.as((await t.signUp()).cookie);
    bia = t.as((await t.signUp()).cookie);
    card = await mkAccount(ana, {
      name: 'Cartão Inter',
      type: 'credit_card',
      closingDay: 5,
      dueDay: 12,
    });
    checking = await mkAccount(ana, {
      name: 'Conta Inter',
      type: 'checking',
      openingBalanceDate: '2026-01-01',
    });
  });

  afterAll(async () => {
    await t.close();
  });

  it('prévia não grava nada e resume', async () => {
    const content =
      HEADER +
      line('20/10/2026', 'PADARIA SAO JOAO SALVADOR BRA', 'Compra à vista', 'R$ 12,50') +
      line('18/10/2026', 'MIX MATEUS', 'Parcela 1/2', 'R$ 64,38') +
      line('12/10/2026', 'PAGAMENTO ON LINE', 'Compra à vista', '-R$ 100,00') +
      line('31/02/2026', 'DATA RUIM', 'Compra à vista', 'R$ 1,00');
    const res = await preview(ana, card, content);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.summary).toEqual({
      total: 3,
      new: 3,
      imported: 0,
      existing: 0,
      payments: 1,
      ignored: 1,
    });
    expect(body.format).toBe('csv');
    expect(body.rows).toHaveLength(3);
    expect(await list(ana, card)).toHaveLength(0);
  });

  it('commit grava, classifica e calcula o mês da fatura', async () => {
    const content =
      HEADER +
      line('02/10/2026', 'PADARIA SAO JOAO SALVADOR BRA', 'Compra à vista', 'R$ 12,50') +
      line('20/10/2026', 'MIX MATEUS', 'Parcela 1/2', 'R$ 64,38');
    const p = (await preview(ana, card, content)).json();
    const res = await commit(ana, p.batchId);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ imported: 2, skippedImported: 0, skippedExisting: 0 });
    const items = await list(ana, card);
    expect(items).toHaveLength(2);
    const mix = items.find((i) => i.description === 'MIX MATEUS PARC 01/02');
    expect(mix).toMatchObject({ source: 'import', amountCents: '-6438' });
    expect(mix?.statementMonth).toBe('2026-11-01');
    const pad = items.find((i) => i.description.startsWith('PADARIA'));
    expect(pad?.statementMonth).toBe('2026-10-01');
    expect(items.every((i) => i.classificationStatus !== undefined)).toBe(true);
  });

  it('o mesmo arquivo não importa duas vezes', async () => {
    const content = HEADER + line('03/10/2026', 'LOJA REPETIDA', 'Compra à vista', 'R$ 10,00');
    const p = (await preview(ana, card, content)).json();
    await commit(ana, p.batchId);
    const again = await preview(ana, card, content);
    expect(again.statusCode).toBe(409);
    expect(again.json().error.message).toContain('já foi importado');
  });

  it('período sobreposto traz só o que é novo; linhas idênticas viram lançamentos distintos', async () => {
    const dup = line('04/10/2026', 'CAFE DA ESQUINA', 'Compra à vista', 'R$ 8,00');
    const first = HEADER + dup + dup;
    const p1 = (await preview(ana, card, first)).json();
    expect(p1.summary.new).toBe(2);
    await commit(ana, p1.batchId);

    const second =
      HEADER + dup + dup + line('05/10/2026', 'CAFE NOVO', 'Compra à vista', 'R$ 9,00');
    const p2 = (await preview(ana, card, second)).json();
    expect(p2.summary).toMatchObject({ new: 1, imported: 2, existing: 0 });
    const res = await commit(ana, p2.batchId);
    expect(res.json()).toEqual({ imported: 1, skippedImported: 2, skippedExisting: 0 });
    const cafes = (await list(ana, card)).filter((i) => i.description.startsWith('CAFE'));
    expect(cafes).toHaveLength(3);

    // Um café a mais no arquivo seguinte é novo (a ordem separa os iguais).
    const third = HEADER + dup + dup + dup;
    const p3 = (await preview(ana, card, third)).json();
    expect(p3.summary).toMatchObject({ new: 1, imported: 2 });
  });

  it('lançamento manual igual conta como já existente', async () => {
    await ana({
      method: 'POST',
      url: '/v1/transactions',
      payload: {
        accountId: card,
        postedDate: '2026-10-07',
        amountCents: '-2500',
        description: 'FEITO A MAO',
      },
    });
    const content =
      HEADER +
      line('07/10/2026', 'FEITO NO BANCO', 'Compra à vista', 'R$ 25,00') +
      line('07/10/2026', 'OUTRO IGUAL', 'Compra à vista', 'R$ 25,00');
    const p = (await preview(ana, card, content)).json();
    expect(p.summary).toMatchObject({ new: 1, existing: 1 });
    const res = (await commit(ana, p.batchId)).json();
    expect(res).toEqual({ imported: 1, skippedImported: 0, skippedExisting: 1 });
  });

  it('pagamento da fatura liga com a saída da conta corrente', async () => {
    await ana({
      method: 'POST',
      url: '/v1/transactions',
      payload: {
        accountId: checking,
        postedDate: '2026-10-12',
        amountCents: '-31337',
        description: 'PAGAMENTO FATURA CARTAO INTER',
      },
    });
    const content =
      HEADER + line('12/10/2026', 'PAGAMENTO ON LINE', 'Compra à vista', '-R$ 313,37');
    const p = (await preview(ana, card, content)).json();
    await commit(ana, p.batchId);
    const pay = (await list(ana, card)).find((i) => i.description === 'PAGAMENTO ON LINE');
    expect(pay?.amountCents).toBe('31337');
    expect(pay?.transfer).not.toBeNull();
  });

  it('OFX usa o FITID: reimportar não duplica', async () => {
    const ofx = (fitid: string, memo: string) => `<STMTTRN>
<DTPOSTED>20261009
<TRNAMT>-10.00
<FITID>${fitid}
<MEMO>${memo}
</STMTTRN>`;
    const wrap = (...b: string[]) =>
      `OFXHEADER:100\n<OFX><BANKTRANLIST>${b.join('\n')}</BANKTRANLIST></OFX>`;
    const p1 = (
      await preview(ana, checking, wrap(ofx('A1', 'LOJA UM')), { filename: 'a.ofx' })
    ).json();
    expect(p1.format).toBe('ofx');
    await commit(ana, p1.batchId);
    const p2 = (
      await preview(ana, checking, wrap(ofx('A1', 'LOJA UM'), ofx('A2', 'LOJA DOIS')), {
        filename: 'b.ofx',
      })
    ).json();
    expect(p2.summary).toMatchObject({ new: 1, imported: 1 });
  });

  it('CSV desconhecido pede mapeamento e depois lê', async () => {
    const csv = 'dia;historico;valor\n11/10/2026;Padaria;45,90\n';
    const need = (await preview(ana, checking, csv)).json();
    expect(need.needsMapping.headers).toEqual(['dia', 'historico', 'valor']);
    const mapping = {
      date: 0,
      description: 1,
      amount: 2,
      dateFormat: 'dd/MM/yyyy',
      decimal: 'comma',
      expenseSign: 'positive',
    };
    const p = (await preview(ana, checking, csv, { mapping })).json();
    expect(p.summary.new).toBe(1);
    expect(p.rows[0]).toMatchObject({ amountCents: '-4590', description: 'Padaria' });
  });

  it('commit duplo: um grava, o outro recebe 409', async () => {
    const content = HEADER + line('13/10/2026', 'DUPLO CLIQUE', 'Compra à vista', 'R$ 11,11');
    const p = (await preview(ana, card, content)).json();
    const [a, b] = await Promise.all([commit(ana, p.batchId), commit(ana, p.batchId)]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    const n = (await list(ana, card)).filter((i) => i.description === 'DUPLO CLIQUE');
    expect(n).toHaveLength(1);
  });

  it('parcelas seguintes da mesma compra entram e vão para a fatura do mês certo', async () => {
    const p1 = (
      await preview(
        ana,
        card,
        HEADER + line('10/08/2026', 'LOJA PARCELADA', 'Parcela 1/3', 'R$ 50,00'),
      )
    ).json();
    await commit(ana, p1.batchId);
    // Meses depois, a fatura traz a parcela 2/3 com a data original da compra.
    const p2 = (
      await preview(
        ana,
        card,
        HEADER + line('10/08/2026', 'LOJA PARCELADA', 'Parcela 2/3', 'R$ 50,00'),
      )
    ).json();
    expect(p2.summary).toMatchObject({ new: 1, imported: 0 });
    await commit(ana, p2.batchId);
    const rows = (await list(ana, card)).filter((i) => i.description.startsWith('LOJA PARCELADA'));
    const byDesc = Object.fromEntries(rows.map((r) => [r.description, r.statementMonth]));
    expect(byDesc['LOJA PARCELADA PARC 01/03']).toBe('2026-09-01');
    expect(byDesc['LOJA PARCELADA PARC 02/03']).toBe('2026-10-01');
  });

  it('FITID repetido com data ou valor diferentes não esconde lançamentos novos', async () => {
    const ofx = (date: string, amount: string) => `OFXHEADER:100
<OFX><STMTTRN><DTPOSTED>${date}<TRNAMT>${amount}<FITID>000000<MEMO>DOC</MEMO></STMTTRN></OFX>`;
    const a = (
      await preview(ana, checking, ofx('20260901', '-10.00'), { filename: 'x.ofx' })
    ).json();
    await commit(ana, a.batchId);
    const b = (
      await preview(ana, checking, ofx('20260902', '-20.00'), { filename: 'y.ofx' })
    ).json();
    expect(b.summary).toMatchObject({ new: 1, imported: 0 });
  });

  it('mesmo arquivo em outra conta, ou depois de apagar os lançamentos, pode ser importado', async () => {
    const content =
      HEADER + line('15/09/2026', 'COMPRA CONTA ERRADA', 'Compra à vista', 'R$ 33,00');
    const p = (await preview(ana, card, content)).json();
    await commit(ana, p.batchId);
    // Outra conta: libera.
    const other = await preview(ana, checking, content);
    expect(other.statusCode).toBe(200);
    // Apaga o que veio do arquivo e reimporta na mesma conta.
    const imported = (await list(ana, card)).filter((i) => i.description === 'COMPRA CONTA ERRADA');
    for (const i of imported) await ana({ method: 'DELETE', url: `/v1/transactions/${i.id}` });
    const again = await preview(ana, card, content);
    expect(again.statusCode).toBe(200);
    expect(again.json().summary.new).toBe(1);
  });

  it('commits concorrentes de arquivos que se sobrepõem pedem para tentar de novo', async () => {
    const shared = line('16/09/2026', 'LINHA COMPARTILHADA', 'Compra à vista', 'R$ 7,77');
    const a = (
      await preview(
        ana,
        card,
        HEADER + shared + line('16/09/2026', 'SO NO A', 'Compra à vista', 'R$ 1,11'),
      )
    ).json();
    const b = (
      await preview(
        ana,
        card,
        HEADER + shared + line('16/09/2026', 'SO NO B', 'Compra à vista', 'R$ 2,22'),
      )
    ).json();
    const [ra, rb] = await Promise.all([commit(ana, a.batchId), commit(ana, b.batchId)]);
    const codes = [ra.statusCode, rb.statusCode].sort();
    expect(codes).toEqual([200, 409]);
    const loser = ra.statusCode === 409 ? ra : rb;
    expect(loser.json().error.message).toContain('Tente');
    expect(loser.json().error.message).not.toContain('já foi importado');
  });

  it('arquivo com mais de 2000 lançamentos pede para dividir', async () => {
    let csv = HEADER;
    for (let n = 0; n < 2001; n++)
      csv += line('01/09/2026', `LOJA ${n}`, 'Compra à vista', 'R$ 1,00');
    const res = await preview(ana, card, csv);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('2000');
  });

  it('isolamento, conta arquivada e entradas inválidas', async () => {
    const content = HEADER + line('14/10/2026', 'SEGREDO DA ANA', 'Compra à vista', 'R$ 5,00');
    const p = (await preview(ana, card, content)).json();
    expect((await commit(bia, p.batchId)).statusCode).toBe(404);
    expect((await preview(bia, card, content)).statusCode).toBe(404);
    expect((await commit(ana, '00000000-0000-4000-8000-000000000000')).statusCode).toBe(404);

    const old = await mkAccount(ana, {
      name: 'Velha',
      type: 'checking',
      openingBalanceDate: '2026-01-01',
    });
    await ana({ method: 'DELETE', url: `/v1/accounts/${old}` });
    expect((await preview(ana, old, content)).statusCode).toBe(409);

    expect((await preview(ana, card, '   ')).statusCode).toBe(400);
    expect((await preview(ana, card, 'a;b\n')).statusCode).toBe(400);
  });
});
