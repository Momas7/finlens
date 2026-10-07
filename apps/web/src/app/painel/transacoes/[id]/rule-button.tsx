'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { createRuleFromTransaction, type RuleState } from '../actions';

export function RuleButton({ transactionId }: { transactionId: string }) {
  const [state, action, pending] = useActionState<RuleState, FormData>(
    createRuleFromTransaction.bind(null, transactionId),
    {},
  );
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="secondary" disabled={pending || state.done}>
        Sempre classificar assim
      </Button>
      <p className="text-[13px] text-ink-soft" role="status">
        {state.message ?? 'Cria uma regra com esta descrição para os próximos lançamentos.'}
      </p>
    </form>
  );
}
