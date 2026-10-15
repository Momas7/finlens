'use client';

import type { TransferSuggestion } from '@finlens/contracts';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import { dismissTransfer, linkTransfer } from './actions';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
});

function Side({ side }: { side: TransferSuggestion['a'] }) {
  return (
    <p className="text-[15px]">
      <span className="text-ink-soft">
        {dateFormatter.format(new Date(`${side.postedDate}T00:00:00Z`))} · {side.accountName} ·{' '}
      </span>
      <span className="font-medium">{side.description}</span>{' '}
      <span className="figure">{formatCents(side.amountCents)}</span>
    </p>
  );
}

export function TransferSuggestionItem({ suggestion: s }: { suggestion: TransferSuggestion }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => setError((await fn()).error));
  const label = s.kind === 'card_payment' ? 'Pagamento de fatura' : 'Transferência';
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-[13px] font-medium text-ink-soft">{label}?</p>
        <Side side={s.a} />
        <Side side={s.b} />
        <p className="text-[13px] text-ink-soft">{s.reason}</p>
        {error && (
          <p role="alert" className="text-[13px] text-mark">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => linkTransfer(s.a.id, s.b.id))}
        >
          É transferência
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => dismissTransfer(s.id))}
        >
          Não é
        </Button>
      </div>
    </li>
  );
}
