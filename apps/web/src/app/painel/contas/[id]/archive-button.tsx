'use client';

import { Button } from '@/components/ui/button';
import { archiveAccount } from '../actions';

export function ArchiveAccountButton({ id }: { id: string }) {
  return (
    <form
      action={archiveAccount.bind(null, id)}
      onSubmit={(e) => {
        if (!window.confirm('Arquivar esta conta? Ela some da lista, mas os lançamentos ficam.')) {
          e.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="secondary">
        Arquivar conta
      </Button>
      <p className="mt-2 text-[13px] text-ink-soft">Os lançamentos continuam no histórico.</p>
    </form>
  );
}
