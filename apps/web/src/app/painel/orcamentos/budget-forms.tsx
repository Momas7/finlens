'use client';

import { type FormEvent, startTransition, useActionState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { applySuggestions, type BudgetFormState, removeBudget, setBudget } from './actions';

/** Envia sem o reset automático do React, para manter o valor digitado em caso de erro. */
function useKeepValuesSubmit(action: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };
}

export function DefineBudget({
  categoryId,
  label,
  defaultValue,
  hint,
}: {
  categoryId: string;
  label: string;
  defaultValue: string;
  hint?: string;
}) {
  const [state, action, pending] = useActionState<BudgetFormState, FormData>(
    setBudget.bind(null, categoryId),
    {},
  );
  const onSubmit = useKeepValuesSubmit(action);
  return (
    <form
      action={action}
      onSubmit={onSubmit}
      noValidate
      className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_auto] sm:items-start"
    >
      <div>
        <Field
          label={`Limite mensal para ${label}`}
          name="amount"
          inputMode="decimal"
          defaultValue={defaultValue}
          error={state.error}
        />
        {hint && <p className="mt-1 text-[13px] text-ink-soft">{hint}</p>}
      </div>
      <Button type="submit" variant="secondary" disabled={pending} className="sm:mt-[1.6rem]">
        Definir orçamento<span className="sr-only"> de {label}</span>
      </Button>
    </form>
  );
}

export function EditBudget({
  categoryId,
  label,
  current,
}: {
  categoryId: string;
  label: string;
  current: string;
}) {
  const [state, action, pending] = useActionState<BudgetFormState, FormData>(
    setBudget.bind(null, categoryId),
    {},
  );
  const onSubmit = useKeepValuesSubmit(action);
  return (
    <details className="group" open={state.error ? true : undefined}>
      <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-[6px] px-2.5 text-[13px] font-medium text-ink-soft hover:bg-ink/5 hover:text-ink [&::-webkit-details-marker]:hidden">
        Alterar<span className="sr-only"> orçamento de {label}</span>
      </summary>
      <form
        action={action}
        onSubmit={onSubmit}
        noValidate
        className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,12rem)_auto] sm:items-start"
      >
        <Field
          label={`Novo limite para ${label}`}
          name="amount"
          inputMode="decimal"
          defaultValue={current}
          error={state.error}
        />
        <Button type="submit" size="md" disabled={pending} className="sm:mt-[1.6rem]">
          Salvar<span className="sr-only"> limite de {label}</span>
        </Button>
      </form>
    </details>
  );
}

export function RemoveBudget({ categoryId, label }: { categoryId: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Remover o orçamento de ${label} a partir deste mês?`)) {
          start(() => removeBudget(categoryId));
        }
      }}
    >
      Remover<span className="sr-only"> orçamento de {label}</span>
    </Button>
  );
}

export function ApplySuggestions({ summary }: { summary: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Criar estes orçamentos?\n${summary}`)) start(() => applySuggestions());
      }}
    >
      Usar sugestões
    </Button>
  );
}
