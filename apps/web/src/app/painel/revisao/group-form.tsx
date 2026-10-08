'use client';

import type { ReviewGroup } from '@finlens/contracts';
import { type FormEvent, startTransition, useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import type { CategoryOption } from '@/lib/categories';
import { confirmGroup, type ReviewState } from './actions';

/** Seletor de categoria pré-preenchido com a sugestão e botão "Confirmar N". */
export function GroupForm({
  group,
  groups,
}: {
  group: ReviewGroup;
  groups: { group: string; options: CategoryOption[] }[];
}) {
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
        defaultValue={group.suggestedCategoryId ?? ''}
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
    </form>
  );
}
