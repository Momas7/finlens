'use client';

import type { Goal } from '@finlens/contracts';
import {
  type FormEvent,
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useTransition,
} from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { centsToInput } from '@/lib/money';
import { archiveGoal, createGoal, type GoalFormState, updateGoal } from './actions';

/** Envia sem o reset automático do React, para manter o que foi digitado em caso de erro. */
function useKeepValuesSubmit(action: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };
}

export function NewGoalForm({ accounts }: { accounts: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<GoalFormState, FormData>(createGoal, {});
  const formRef = useRef<HTMLFormElement>(null);
  const onSubmit = useKeepValuesSubmit(action);
  useEffect(() => {
    if (state.done) formRef.current?.reset();
  }, [state]);
  const errors = state.fieldErrors ?? {};
  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={onSubmit}
      noValidate
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field
        label="Nome"
        name="name"
        maxLength={60}
        placeholder="Reserva de emergência"
        error={errors.name}
      />
      <Field label="Valor-alvo" name="target" inputMode="decimal" error={errors.target} />
      <Select label="Conta" name="accountId" error={errors.accountId}>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      <Field
        label="Data-alvo"
        name="targetDate"
        type="date"
        hint="Opcional. Com data, mostramos quanto guardar por mês."
        error={errors.targetDate}
      />
      <Field
        label="Rende ao ano (%)"
        name="rate"
        inputMode="decimal"
        hint="Opcional, como 10,5."
        error={errors.rate}
      />
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          Criar meta
        </Button>
      </div>
      {state.formError && (
        <p role="alert" className="text-[13px] text-mark sm:col-span-2">
          {state.formError}
        </p>
      )}
    </form>
  );
}

export function EditGoal({ goal }: { goal: Goal }) {
  const [state, action, pending] = useActionState<GoalFormState, FormData>(
    updateGoal.bind(null, goal.id),
    {},
  );
  const onSubmit = useKeepValuesSubmit(action);
  const errors = state.fieldErrors ?? {};
  return (
    <details className="group" open={state.fieldErrors || state.formError ? true : undefined}>
      <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-[6px] px-2.5 text-[13px] font-medium text-ink-soft hover:bg-ink/5 hover:text-ink [&::-webkit-details-marker]:hidden">
        Alterar<span className="sr-only"> {goal.name}</span>
      </summary>
      <form
        action={action}
        onSubmit={onSubmit}
        noValidate
        className="mt-3 grid gap-4 sm:grid-cols-2"
      >
        <Field
          label={`Nome de ${goal.name}`}
          name="name"
          maxLength={60}
          defaultValue={goal.name}
          error={errors.name}
        />
        <Field
          label={`Valor-alvo de ${goal.name}`}
          name="target"
          inputMode="decimal"
          defaultValue={centsToInput(goal.targetCents)}
          error={errors.target}
        />
        <Field
          label={`Data-alvo de ${goal.name}`}
          name="targetDate"
          type="date"
          defaultValue={goal.targetDate ?? ''}
          error={errors.targetDate}
        />
        <Field
          label={`Rende ao ano (%) de ${goal.name}`}
          name="rate"
          inputMode="decimal"
          defaultValue={goal.annualRatePercent ?? ''}
          error={errors.rate}
        />
        <div>
          <Button type="submit" disabled={pending}>
            Salvar<span className="sr-only"> {goal.name}</span>
          </Button>
        </div>
        {state.formError && (
          <p role="alert" className="text-[13px] text-mark sm:col-span-2">
            {state.formError}
          </p>
        )}
      </form>
    </details>
  );
}

export function ArchiveGoal({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Arquivar a meta ${name}? O saldo da conta não muda.`)) {
          start(() => archiveGoal(id));
        }
      }}
    >
      Arquivar<span className="sr-only"> {name}</span>
    </Button>
  );
}
