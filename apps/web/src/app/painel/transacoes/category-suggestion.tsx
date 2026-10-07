'use client';

import { ClassificationResult } from '@finlens/contracts';
import { useEffect, useState } from 'react';
import { Scale } from '@/components/ui/scale';
import { parseAmountInput } from '@/lib/money';

const DEBOUNCE_MS = 300;

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: ClassificationResult }
  | { kind: 'error' };

/** Mostra, enquanto a pessoa digita, a categoria que o modo "Automática" vai aplicar. */
export function CategorySuggestion({
  description,
  amount,
  income,
  accountId,
}: {
  description: string;
  amount: string;
  income: boolean;
  accountId: string;
}) {
  // Com descrição já preenchida (edição), começa em "Classificando…" em vez do convite a digitar.
  const [state, setState] = useState<State>(
    description.trim() ? { kind: 'loading' } : { kind: 'idle' },
  );

  useEffect(() => {
    const text = description.trim();
    if (text === '') {
      setState({ kind: 'idle' });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState({ kind: 'loading' });
      const abs = parseAmountInput(amount) ?? '1';
      const params = new URLSearchParams({
        description: text,
        amountCents: income ? abs : `-${abs}`,
      });
      if (accountId) params.set('accountId', accountId);
      try {
        const response = await fetch(`/v1/classify?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        setState({ kind: 'ready', result: ClassificationResult.parse(await response.json()) });
      } catch (err) {
        if (!controller.signal.aborted) setState({ kind: 'error' });
        void err;
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [description, amount, income, accountId]);

  return (
    <div
      role="status"
      aria-label="Sugestão automática"
      aria-live="polite"
      className="min-h-[3.25rem] text-[13px]"
    >
      {state.kind === 'idle' && (
        <p className="text-ink-soft">Digite a descrição para ver a categoria sugerida.</p>
      )}
      {state.kind === 'loading' && <p className="text-ink-soft">Classificando…</p>}
      {state.kind === 'error' && (
        <p className="text-ink-soft">Não foi possível sugerir agora. Você ainda pode salvar.</p>
      )}
      {state.kind === 'ready' && <SuggestionBody result={state.result} />}
    </div>
  );
}

function SuggestionBody({ result }: { result: ClassificationResult }) {
  if (result.status === 'none' || !result.categoryLabel) {
    return (
      <p className="text-ink-soft">
        Sem sugestão para essa descrição. O lançamento fica sem categoria.
      </p>
    );
  }
  const percent = Math.round(result.confidence * 100);
  const applies = result.status === 'auto' || result.status === 'likely';
  return (
    <div className="space-y-1.5">
      <p>
        <span className="text-ink-soft">
          {applies ? 'Automática: ' : 'Sugestão (não será aplicada): '}
        </span>
        <span className="font-medium">{result.categoryLabel}</span>
        <span className="figure ml-2 text-[15px]">{percent}%</span>
      </p>
      <Scale
        className="max-w-[12rem]"
        value={percent}
        max={100}
        ticks={10}
        label="Confiança da sugestão"
        valueText={`${percent}%`}
      />
      {result.explanation && <p className="text-ink-soft">{result.explanation}</p>}
    </div>
  );
}
