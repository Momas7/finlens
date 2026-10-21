import type { Config } from '../../config';

type LlmConfig = NonNullable<Config['llm']>;

/** Pergunta ao servidor do LLM. Devolve o texto da resposta, ou null se falhar ou demorar. */
export async function askLlm(
  llm: LlmConfig,
  prompt: { system: string; user: string },
): Promise<string | null> {
  try {
    const res = await fetch(`${llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(llm.apiKey ? { authorization: `Bearer ${llm.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: llm.model,
        temperature: 0,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
      signal: AbortSignal.timeout(llm.timeoutMs),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const content = json.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : null;
  } catch {
    return null;
  }
}
