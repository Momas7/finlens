'use client';

import { type FormEvent, startTransition, useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { type DeleteState, deleteAccount } from './actions';

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, {});
  const errors = state.fieldErrors ?? {};
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!window.confirm('Excluir sua conta e todos os seus dados? Isso não pode ser desfeito.'))
      return;
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="max-w-md space-y-4">
      <Field
        label="Senha atual"
        name="password"
        type="password"
        autoComplete="current-password"
        error={errors.password}
      />
      <Field
        label="Digite EXCLUIR para confirmar"
        name="confirm"
        autoComplete="off"
        error={errors.confirm}
      />
      {state.formError && (
        <p role="alert" className="text-[13px] text-mark">
          {state.formError}
        </p>
      )}
      <Button type="submit" disabled={pending} className="bg-mark text-page hover:bg-mark/85">
        Excluir conta definitivamente
      </Button>
    </form>
  );
}
