import type { ReactNode } from 'react';
import { getMe } from '@/lib/me';
import { SignOutButton } from './sign-out-button';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <span className="font-semibold tracking-tight">Finlens</span>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Workspace: {me.workspace.name}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
