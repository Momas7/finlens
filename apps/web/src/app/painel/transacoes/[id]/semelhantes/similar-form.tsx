'use client';

import type { SimilarItem } from '@finlens/contracts';
import Link from 'next/link';
import { type FormEvent, startTransition, useActionState } from 'react';
import { Button, buttonClasses } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import { type ApplyState, applyToSimilar } from '../../actions';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
});

export function SimilarForm({
  items,
  categoryId,
  from,
  back,
}: {
  items: SimilarItem[];
  categoryId: string;
  from?: string;
  back: string;
}) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(
    applyToSimilar.bind(null, categoryId, from),
    {},
  );
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-5" noValidate>
      <ul className="divide-y divide-scale rounded-[6px] border border-scale bg-raised">
        {items.map(({ transaction: t, currentCategoryLabel, preselected }) => (
          <li key={t.id}>
            <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
              <input
                type="checkbox"
                name="ids"
                value={t.id}
                defaultChecked={preselected}
                className="mt-1 size-4 accent-ink"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="font-medium break-all">{t.description}</span>
                  <span className="figure">{formatCents(t.amountCents)}</span>
                </span>
                <span className="block text-[13px] text-ink-soft">
                  {dateFormatter.format(new Date(`${t.postedDate}T00:00:00Z`))} ·{' '}
                  {currentCategoryLabel ?? 'Sem categoria'}
                  {!preselected && <> · valor diferente do que você corrigiu</>}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {state.error && (
        <p role="alert" className="text-[13px] text-mark">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          Aplicar aos selecionados
        </Button>
        <Link href={back} className={buttonClasses('ghost')}>
          Agora não
        </Link>
      </div>
    </form>
  );
}
