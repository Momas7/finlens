/** Teto da confiança de uma sugestão do LLM: nunca vira classificação automática. */
export const LLM_MAX_CONFIDENCE = 0.8;

export function buildLlmPrompt(
  normalized: string,
  sign: 'out' | 'in',
  categoryNames: string[],
): { system: string; user: string } {
  const system =
    'Você classifica descrições de extratos bancários brasileiros em categorias. ' +
    'Responda apenas com JSON no formato {"category":"<nome exato da lista>","confidence":<0 a 1>}. ' +
    'Se nenhuma categoria servir ou você não tiver certeza, responda {"category":null}. ' +
    'Nunca invente categorias e nunca escreva texto fora do JSON.';
  const user = [
    `Descrição: ${normalized}`,
    `Sentido: ${sign === 'out' ? 'saída (despesa)' : 'entrada (receita)'}`,
    'Categorias:',
    ...categoryNames.map((n) => `- ${n}`),
  ].join('\n');
  return { system, user };
}

/** Lê a resposta do modelo; só aceita uma categoria da lista, com confiança limitada ao teto. */
export function parseLlmAnswer(
  text: string,
  categoryNames: string[],
): { category: string; confidence: number } | null {
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { category, confidence } = parsed as { category?: unknown; confidence?: unknown };
  if (typeof category !== 'string' || !categoryNames.includes(category)) return null;
  if (confidence === undefined) return { category, confidence: 0.5 };
  if (typeof confidence !== 'number' || !(confidence >= 0 && confidence <= 1)) return null;
  return { category, confidence: Math.min(confidence, LLM_MAX_CONFIDENCE) };
}
