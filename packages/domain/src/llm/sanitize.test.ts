import { describe, expect, it } from 'vitest';
import { textForLlm } from './sanitize';

describe('textForLlm', () => {
  it('mantém o estabelecimento', () => {
    expect(textForLlm('COMPRA NO DEBITO PADARIA DO ZE SAO PAULO SP')).toBe('PADARIA DO ZE');
  });

  it('não envia contraparte de PIX', () => {
    expect(textForLlm('PIX ENVIADO JOAO DA SILVA')).toBeNull();
    expect(textForLlm('Pix recebido Maria Souza')).toBeNull();
  });

  it('não envia TED, DOC nem transferência entre pessoas', () => {
    expect(textForLlm('TED 123.456.789-00 MARIA SOUZA')).toBeNull();
    expect(textForLlm('DOC JOSE LIMA')).toBeNull();
    expect(textForLlm('TRANSFERENCIA RECEBIDA ANA')).toBeNull();
  });

  it('derruba tokens com dígito, mesmo curtos ou com hífen', () => {
    expect(textForLlm('LOJA 12 CNPJ 12-34 CENTRAL')).toBe('LOJA CNPJ CENTRAL');
  });

  it('descrição só com números vira null', () => {
    expect(textForLlm('123456789')).toBeNull();
  });
});
