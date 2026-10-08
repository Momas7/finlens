'use client';

import type { RuleSuggestion } from '@finlens/contracts';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import { acceptRuleSuggestion, dismissRuleSuggestion } from './actions';

function rangeText(s: RuleSuggestion): string {
  if (s.minAmountCents && s.maxAmountCents) {
    return ` entre ${formatCents(s.minAmountCents)} e ${formatCents(s.maxAmountCents)}`;
  }
  if (s.minAmountCents) return ` acima de ${formatCents(s.minAmountCents)}`;
  if (s.maxAmountCents) return ` até ${formatCents(s.maxAmountCents)}`;
  return '';
}

export function RuleSuggestionItem({ suggestion: s }: { suggestion: RuleSuggestion }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => setError((await fn()).error));
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 space-y-0.5">
        <p>
          Sempre classificar <strong className="font-semibold">{s.pattern}</strong>
          {rangeText(s)} como <strong className="font-semibold">{s.categoryLabel}</strong>?
        </p>
        <p className="text-[13px] text-ink-soft">
          Baseado em {s.basedOn} {s.basedOn === 1 ? 'confirmação sua' : 'confirmações suas'}.
        </p>
        {error && (
          <p role="alert" className="text-[13px] text-mark">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => run(() => acceptRuleSuggestion(s))}>
          Criar regra
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => dismissRuleSuggestion(s.id))}
        >
          Dispensar
        </Button>
      </div>
    </li>
  );
}
