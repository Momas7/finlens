'use client';

import type { ReviewGroup } from '@finlens/contracts';
import { type FormEvent, startTransition, useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import type { CategoryOption } from '@/lib/categories';
import { type AiSuggestion, confirmGroup, type ReviewState, suggestWithAi } from './actions';

/** Seletor de categoria pré-preenchido com a sugestão e botão "Confirmar N". */
export function GroupForm({
  group,
  groups,
  aiEnabled = false,
}: {
  group: ReviewGroup;
  groups: { group: string; options: CategoryOption[] }[];
  /** IA local ligada: mostra "Sugerir com IA" nos grupos sem sugestão. */
  aiEnabled?: boolean;
}) {
  const [ai, setAi] = useState<AiSuggestion | null>(null);
  const [asking, setAsking] = useState(false);
  const [state, action, pending] = useActionState<ReviewState, FormData>(confirmGroup, {});
  const kind = group.sign === 'out' ? 'expense' : 'income';
  const visible = groups
    .map((g) => ({
      ...g,
      options: g.options.filter((o) => o.kind === kind || o.kind === 'movement'),
    }))
    .filter((g) => g.options.length > 0);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };
  const count = group.transactionIds.length;
  const askAi = () => {
    if (asking) return;
    setAsking(true);
    startTransition(async () => {
      try {
        const first = group.transactionIds[0];
        setAi(first ? await suggestWithAi(first) : { categoryId: null });
      } catch {
        setAi({ categoryId: null });
      } finally {
        setAsking(false);
      }
    });
  };
  const offered = ai?.categoryId ?? null;
  // Categoria que sumiu da lista (arquivada ou de outro tipo) não vale como sugestão.
  const aiCategory = visible.some((g) => g.options.some((o) => o.id === offered)) ? offered : null;
  const showAiButton = aiEnabled && !group.suggestedCategoryId;
  return (
    <form
      action={action}
      onSubmit={onSubmit}
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
      noValidate
    >
      <input type="hidden" name="ids" value={JSON.stringify(group.transactionIds)} />
      <Select
        label={`Categoria para ${group.label}`}
        name="categoryId"
        key={aiCategory ?? 'none'}
        defaultValue={aiCategory ?? group.suggestedCategoryId ?? ''}
        error={state.error}
      >
        <option value="">Escolha…</option>
        {visible.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
      <Button type="submit" disabled={pending} className={state.error ? 'sm:mb-[1.625rem]' : ''}>
        Confirmar {count}
      </Button>
      {showAiButton && (
        <div className="space-y-1 sm:col-span-2">
          <Button type="button" variant="ghost" onClick={askAi} aria-disabled={asking}>
            {asking ? 'Consultando a IA…' : 'Sugerir com IA'}
          </Button>
          <p role="status" className="text-[13px] text-ink-soft">
            {ai && aiCategory && 'confidence' in ai
              ? `Sugestão da IA local (confiança ${Math.round(ai.confidence * 100)}%). Revise antes de confirmar.`
              : ai
                ? 'A IA local não encontrou uma categoria.'
                : ''}
          </p>
        </div>
      )}
    </form>
  );
}
