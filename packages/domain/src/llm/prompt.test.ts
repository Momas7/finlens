import { describe, expect, it } from 'vitest';
import { buildLlmPrompt, LLM_MAX_CONFIDENCE, parseLlmAnswer } from './prompt';

const names = ['Alimentação › Mercado', 'Transporte › Combustível', 'Lazer › Bares'];

describe('buildLlmPrompt', () => {
  it('leva só a descrição, o sentido e os nomes das categorias', () => {
    const { system, user } = buildLlmPrompt('PADARIA DO ZE', 'out', names);
    const all = `${system}\n${user}`;
    expect(user).toContain('PADARIA DO ZE');
    expect(user).toContain('saída');
    for (const n of names) expect(all).toContain(n);
    expect(all).not.toMatch(/R\$|\d{2}\/\d{2}\/\d{4}/);
    expect(system).toContain('JSON');
  });
  it('entrada usa o sentido certo', () => {
    expect(buildLlmPrompt('FREELA CLIENTE', 'in', ['Receitas › Freelance']).user).toContain(
      'entrada',
    );
  });
});

describe('parseLlmAnswer', () => {
  it('JSON puro e dentro de texto', () => {
    expect(parseLlmAnswer('{"category":"Lazer › Bares","confidence":0.7}', names)).toEqual({
      category: 'Lazer › Bares',
      confidence: 0.7,
    });
    expect(
      parseLlmAnswer(
        'Claro! ```json\n{"category":"Alimentação › Mercado","confidence":0.6}\n```',
        names,
      ),
    ).toEqual({ category: 'Alimentação › Mercado', confidence: 0.6 });
  });
  it('limita a confiança a 0,80', () => {
    expect(
      parseLlmAnswer('{"category":"Lazer › Bares","confidence":0.99}', names)?.confidence,
    ).toBe(LLM_MAX_CONFIDENCE);
  });
  it('descarta categoria fora da lista, nula, lixo e confiança inválida', () => {
    expect(parseLlmAnswer('{"category":"Moradia › Aluguel","confidence":0.9}', names)).toBeNull();
    expect(parseLlmAnswer('{"category":null}', names)).toBeNull();
    expect(parseLlmAnswer('não sei', names)).toBeNull();
    expect(parseLlmAnswer('{"category":"Lazer › Bares","confidence":1.7}', names)).toBeNull();
    expect(parseLlmAnswer('{"category":"Lazer › Bares"', names)).toBeNull();
  });
  it('confiança ausente vira 0,5', () => {
    expect(parseLlmAnswer('{"category":"Lazer › Bares"}', names)?.confidence).toBe(0.5);
  });
});
