import { describe, expect, it } from 'vitest';
import { amountBucket, normalize } from './normalize';

describe('normalize', () => {
  it.each([
    ['IFOOD*REST', 'IFOOD REST'],
    ['UBER *TRIP', 'UBER TRIP'],
    ['UBER *EATS', 'UBER EATS'],
    ['UBER* PENDING', 'UBER PENDING'],
    ['  uber   *  trip  ', 'UBER TRIP'],
    ['NETFLIX.COM', 'NETFLIX COM'],
    ['NETFLIX.COM SAO PAULO BRA', 'NETFLIX COM'],
    ['PAG*ACADEMIA SMART FIT', 'ACADEMIA SMART FIT'],
    ['PAG*Padaria Pão Quente', 'PADARIA PAO QUENTE'],
    ['PAGSEGURO*LOJA DA ANA', 'LOJA DA ANA'],
    ['MP*MERCADOLIVRE', 'MERCADOLIVRE'],
    ['MERCADOPAGO*PADARIA SAO JOAO', 'PADARIA SAO JOAO'],
    ['PG *TON CAFE DA MANHA', 'TON CAFE DA MANHA'],
    ['IZ *BARRACA DO ZE', 'BARRACA DO ZE'],
    ['SUMUP *ACAI PRAIA', 'ACAI PRAIA'],
    ['EC *LANCHONETE DO BAIRRO', 'LANCHONETE DO BAIRRO'],
    ['PAYPAL *STEAM GAMES', 'STEAM GAMES'],
    ['EBANX*SPOTIFY', 'SPOTIFY'],
    ['PICPAY*JOAO', 'JOAO'],
    ['SPOTIFY', 'SPOTIFY'],
    ['STEAMGAMES.COM 4259522985', 'STEAMGAMES COM'],
    ['APPLE.COM/BILL', 'APPLE COM BILL'],
    ['GOOGLE *YOUTUBEPREMIUM', 'GOOGLE YOUTUBEPREMIUM'],
    ['POSTO IPIRANGA SAO PAULO SP', 'POSTO IPIRANGA'],
    ['POSTO SHELL 25/10', 'POSTO SHELL'],
    ['DROGASIL 1234 BELO HORIZONTE BR', 'DROGASIL'],
    ['DROGARIA SAO PAULO', 'DROGARIA SAO PAULO'],
    ['DROGARIA SAO PAULO 1234 SAO PAULO SP', 'DROGARIA SAO PAULO'],
    ['AMAZON BR', 'AMAZON'],
    ['MCDONALDS 123456', 'MCDONALDS'],
    ['LOJAS RENNER 0457', 'LOJAS RENNER'],
    ['ATACADAO S/A', 'ATACADAO S A'],
    ['C&A MODAS 123', 'C&A MODAS 123'],
    ['50% OFF LOJA', '50% OFF LOJA'],
    ['SHOPEE *PEDIDO 12345', 'SHOPEE PEDIDO'],
    ['COMPRA CARTAO PADARIA REAL', 'PADARIA REAL'],
    ['COMPRA NO DEBITO SUPERMERCADO DIA', 'SUPERMERCADO DIA'],
    ['DEB AUT ENEL SP', 'ENEL'],
    ['PIX ENVIADO MARIA CLARA', 'MARIA CLARA'],
    ['PIX RECEBIDO JOAO SILVA', 'JOAO SILVA'],
    ['NOTEBOOK DELL PARC 04/12', 'NOTEBOOK DELL'],
    ['PARCELA 2 DE 6 MAGAZINE LUIZA', 'MAGAZINE LUIZA'],
    ['ANUIDADE DIFERENCIADA 03/12', 'ANUIDADE DIFERENCIADA'],
    ['PAGAMENTO FATURA', 'PAGAMENTO FATURA'],
    ['IOF COMPRA INTERNACIONAL', 'IOF COMPRA INTERNACIONAL'],
    ['Café Três Corações', 'CAFE TRES CORACOES'],
    ['PIX ENVIADO', ''],
    ['****', ''],
  ])('%s → %s', (raw, expected) => expect(normalize(raw).normalized).toBe(expected));

  it('tokens', () =>
    expect(normalize('PAG*ACADEMIA SMART FIT').tokens).toEqual(['ACADEMIA', 'SMART', 'FIT']));
  it('gateway', () => {
    expect(normalize('MP*X LOJA').gateway).toBe('MP');
    expect(normalize('IFOOD*REST').gateway).toBeNull();
  });
  it('parcela', () => {
    expect(normalize('NOTEBOOK DELL PARC 04/12').installment).toEqual({ current: 4, total: 12 });
    expect(normalize('PARCELA 2 DE 6 MAGAZINE LUIZA').installment).toEqual({
      current: 2,
      total: 6,
    });
    expect(normalize('LOJA 12/10').installment).toBeNull();
    expect(normalize('LOJA 12/10').normalized).toBe('LOJA');
  });
  it('contraparte de PIX', () => {
    expect(normalize('PIX ENVIADO MARIA CLARA').counterparty).toBe('MARIA CLARA');
    expect(normalize('PIX ENVIADO').counterparty).toBeNull();
    expect(normalize('UBER TRIP').counterparty).toBeNull();
  });
});

describe('amountBucket', () => {
  it.each([
    [-4999n, 'xs'],
    [0n, 'xs'],
    [5000n, 'sm'],
    [19999n, 'sm'],
    [20000n, 'md'],
    [-99999n, 'md'],
    [100000n, 'lg'],
  ] as const)('%s → %s', (cents, bucket) => expect(amountBucket(cents)).toBe(bucket));
});
