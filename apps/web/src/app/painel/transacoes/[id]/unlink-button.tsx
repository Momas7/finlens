'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { unlinkTransfer } from '../actions';

export function UnlinkButton({ id, withAccount }: { id: string; withAccount: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" disabled={pending} onClick={() => start(() => unlinkTransfer(id))}>
      Desfazer transferência
      <span className="sr-only"> com {withAccount}</span>
    </Button>
  );
}
