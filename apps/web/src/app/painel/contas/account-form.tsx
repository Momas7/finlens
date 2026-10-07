'use client';

import type { Account } from '@finlens/contracts';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { type FormState, saveAccount } from './actions';

const TYPES = [
  { value: 'checking', label: 'Conta corrente' },
  { value: 'savings', label: 'Poupança' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'credit_card', label: 'Cartão de crédito' },
] as const;

function centsToInput(cents: string) {
  const value = BigInt(cents);
  const abs = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${abs / 100n},${(abs % 100n).toString().padStart(2, '0')}`;
}

export function AccountForm({ account, today }: { account?: Account; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAccount, {});
  const [type, setType] = useState<string>(account?.type ?? 'checking');
  const errors = state.fieldErrors ?? {};
  const isCard = type === 'credit_card';

  return (
    <form action={action} className="max-w-md space-y-5" noValidate>
      {account && <input type="hidden" name="id" value={account.id} />}
      <Field
        label="Nome"
        name="name"
        defaultValue={account?.name}
        error={errors.name}
        required
        maxLength={60}
      />
      <div className="space-y-1.5">
        <label htmlFor="account-type" className="block text-[13px] font-medium">
          Tipo
        </label>
        <select
          id="account-type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          disabled={Boolean(account)}
          aria-describedby={account ? 'account-type-hint' : undefined}
          className="h-11 w-full rounded-[6px] border border-scale bg-raised px-3 text-[15px] disabled:opacity-70"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {account && <input type="hidden" name="type" value={type} />}
        {account && (
          <p id="account-type-hint" className="text-[13px] text-ink-soft">
            O tipo não muda depois de criado.
          </p>
        )}
      </div>
      <Field
        label="Instituição"
        name="institution"
        defaultValue={account?.institution ?? ''}
        error={errors.institution}
        hint="Opcional, como Banco Inter."
        maxLength={60}
      />
      {isCard ? (
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Dia de fechamento"
            name="closingDay"
            type="number"
            min={1}
            max={31}
            inputMode="numeric"
            defaultValue={account?.closingDay ?? ''}
            error={errors.closingDay}
          />
          <Field
            label="Dia de vencimento"
            name="dueDay"
            type="number"
            min={1}
            max={31}
            inputMode="numeric"
            defaultValue={account?.dueDay ?? ''}
            error={errors.dueDay}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Saldo inicial"
            name="openingBalance"
            inputMode="decimal"
            defaultValue={account ? centsToInput(account.openingBalanceCents) : '0,00'}
            error={errors.openingBalance}
          />
          <Field
            label="Data do saldo"
            name="openingBalanceDate"
            type="date"
            defaultValue={account?.openingBalanceDate ?? today}
            error={errors.openingBalanceDate}
          />
        </div>
      )}
      {state.formError && (
        <p role="alert" className="text-[13px] text-mark">
          {state.formError}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Salvar conta
      </Button>
    </form>
  );
}
