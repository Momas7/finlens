'use client';

import { Button } from '@/components/ui/button';
import { deleteTransaction } from '../actions';

export function DeleteTransactionButton({ id }: { id: string }) {
  return (
    <form
      action={deleteTransaction.bind(null, id)}
      onSubmit={(e) => {
        if (!window.confirm('Excluir este lançamento? Essa ação não pode ser desfeita.'))
          e.preventDefault();
      }}
    >
      <Button type="submit" variant="secondary">
        Excluir lançamento
      </Button>
    </form>
  );
}
