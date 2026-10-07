import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { getMe } from '@/lib/me';
import { SignOutButton } from './sign-out-button';

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  const month = monthFormatter.format(new Date());
  return (
    <div className="min-h-dvh">
      <header className="border-b border-scale bg-raised">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Logo size="sm" />
          <span className="hidden text-[13px] text-ink-soft capitalize sm:inline">{month}</span>
          <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-3">
            <ThemeToggle />
            <span className="min-w-0 truncate text-[13px] text-ink-soft">
              Workspace: {me.workspace.name}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
