'use client';

import { useTransition } from 'react';
import { dismissInsight } from '@/app/painel/insights/actions';
import { Button } from '@/components/ui/button';

export function DismissInsight({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      aria-label={`Dispensar: ${title}`}
      onClick={() => start(() => dismissInsight(id))}
    >
      Dispensar
    </Button>
  );
}
