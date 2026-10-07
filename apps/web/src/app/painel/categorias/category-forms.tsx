'use client';

import type { CategoryNode } from '@finlens/contracts';
import { type FormEvent, startTransition, useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import {
  archiveCategory,
  createCategory,
  deleteRule,
  type FormState,
  renameCategory,
} from './actions';

/** Envia sem o reset automático do React, para manter o que foi digitado em caso de erro. */
function useKeepValuesSubmit(action: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };
}

export function NewCategoryForm({ roots }: { roots: CategoryNode[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createCategory, {});
  const formRef = useRef<HTMLFormElement>(null);
  const onSubmit = useKeepValuesSubmit(action);
  useEffect(() => {
    if (state.done) formRef.current?.reset();
  }, [state]);
  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={onSubmit}
      className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start"
      noValidate
    >
      <Field label="Nome" name="name" maxLength={40} error={state.fieldErrors?.name} />
      <Select label="Dentro de" name="parentId" defaultValue="" error={state.fieldErrors?.parentId}>
        <option value="">Nenhuma (categoria principal)</option>
        {roots.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </Select>
      <Button type="submit" disabled={pending} className="sm:mt-[1.6rem]">
        Criar categoria
      </Button>
      {state.formError && (
        <p role="alert" className="text-[13px] text-mark sm:col-span-3">
          {state.formError}
        </p>
      )}
    </form>
  );
}

export function RenameCategory({ category }: { category: CategoryNode }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    renameCategory.bind(null, category.id),
    {},
  );
  const onSubmit = useKeepValuesSubmit(action);
  return (
    <details className="group">
      <summary className="cursor-pointer rounded-[6px] px-2 py-1 text-[13px] text-ink-soft hover:text-ink">
        Renomear<span className="sr-only"> {category.name}</span>
      </summary>
      <form
        action={action}
        onSubmit={onSubmit}
        className="mt-2 flex flex-wrap items-start gap-2"
        noValidate
      >
        <Field
          className="min-w-[12rem] flex-1"
          label={`Novo nome de ${category.name}`}
          name="name"
          defaultValue={category.name}
          maxLength={40}
          error={state.fieldErrors?.name ?? state.formError}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={pending}
          className="mt-[1.6rem]"
          aria-label={`Salvar nome de ${category.name}`}
        >
          Salvar
        </Button>
      </form>
    </details>
  );
}

export function ArchiveCategory({ category }: { category: CategoryNode }) {
  return (
    <form
      action={archiveCategory.bind(null, category.id)}
      onSubmit={(e) => {
        const extra =
          category.children.length > 0 ? ' As subcategorias também serão arquivadas.' : '';
        if (
          !window.confirm(
            `Arquivar ${category.name}? Lançamentos antigos mantêm a categoria.${extra}`,
          )
        )
          e.preventDefault();
      }}
    >
      <Button
        type="submit"
        variant="ghost"
        className="h-8 px-2 text-[13px]"
        aria-label={`Arquivar ${category.name}`}
      >
        Arquivar
      </Button>
    </form>
  );
}

export function DeleteRule({ id, pattern }: { id: string; pattern: string }) {
  return (
    <form
      action={deleteRule.bind(null, id)}
      onSubmit={(e) => {
        if (!window.confirm(`Excluir a regra "${pattern}"?`)) e.preventDefault();
      }}
    >
      <Button
        type="submit"
        variant="ghost"
        className="h-8 px-2 text-[13px]"
        aria-label={`Excluir regra ${pattern}`}
      >
        Excluir
      </Button>
    </form>
  );
}
