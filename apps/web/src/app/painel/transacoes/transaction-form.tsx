'use client';

import type { Account, Transaction } from '@finlens/contracts';
import { type FormEvent, startTransition, useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { accountLabel } from '@/lib/accounts';
import type { CategoryOption } from '@/lib/categories';
import { type FormState, saveTransaction } from './actions';

type Kind = 'expense' | 'income';

function absToInput(cents: string) {
  const abs = cents.replace('-', '').padStart(3, '0');
  return `${Number(abs.slice(0, -2)).toLocaleString('pt-BR')},${abs.slice(-2)}`;
}

export function TransactionForm({
  accounts,
  groups,
  today,
  transaction,
}: {
  accounts: Account[];
  groups: { group: string; options: CategoryOption[] }[];
  today: string;
  transaction?: Transaction;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTransaction, {});
  const [kind, setKind] = useState<Kind>(
    transaction && !transaction.amountCents.startsWith('-') ? 'income' : 'expense',
  );
  const errors = state.fieldErrors ?? {};

  // Com `action` direto, o React limpa campos não controlados ao fim da action, mesmo
  // quando ela devolve erros de validação. Enviar por aqui preserva o que foi digitado.
  function submitKeepingValues(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }
  const visible = groups
    .map((g) => ({
      ...g,
      options: g.options.filter((o) => o.kind === kind || o.kind === 'movement'),
    }))
    .filter((g) => g.options.length > 0);

  return (
    <form action={action} onSubmit={submitKeepingValues} className="max-w-xl space-y-5" noValidate>
      {transaction && <input type="hidden" name="id" value={transaction.id} />}
      <fieldset>
        <legend className="text-[13px] font-medium">Tipo</legend>
        <div className="mt-2 inline-flex rounded-[6px] border border-scale bg-raised p-1">
          {(
            [
              ['expense', 'Saída'],
              ['income', 'Entrada'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`relative cursor-pointer rounded-[4px] px-4 py-1.5 text-[15px] has-focus-visible:outline-2 has-focus-visible:outline-ink ${
                kind === value ? 'bg-ink text-page' : 'text-ink-soft'
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Valor"
          name="amount"
          inputMode="decimal"
          placeholder="45,90"
          defaultValue={transaction ? absToInput(transaction.amountCents) : ''}
          error={errors.amount}
        />
        <Field
          label="Data"
          name="postedDate"
          type="date"
          defaultValue={transaction?.postedDate ?? today}
          error={errors.postedDate}
        />
      </div>
      <Field
        label="Descrição"
        name="description"
        maxLength={140}
        defaultValue={transaction?.description}
        error={errors.description}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Conta"
          name="accountId"
          defaultValue={transaction?.accountId}
          error={errors.accountId}
        >
          {accounts
            .filter((a) => !a.archived || a.id === transaction?.accountId)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {accountLabel(a)}
              </option>
            ))}
        </Select>
        <Select
          key={kind}
          label="Categoria"
          name="categoryId"
          defaultValue={transaction?.categoryId ?? ''}
          error={errors.categoryId}
        >
          <option value="">Sem categoria</option>
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
      </div>
      <Field
        label="Observação"
        name="notes"
        maxLength={500}
        defaultValue={transaction?.notes ?? ''}
        hint="Opcional."
        error={errors.notes}
      />
      {state.formError && (
        <p role="alert" className="text-[13px] text-mark">
          {state.formError}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Salvar lançamento
      </Button>
    </form>
  );
}
