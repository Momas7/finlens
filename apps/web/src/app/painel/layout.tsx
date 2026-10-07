import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { getMe } from '@/lib/me';
import { PainelNav } from './nav';
import { SignOutButton } from './sign-out-button';

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  const formatted = monthFormatter.format(new Date());
  const month = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  return (
    <div className="min-h-dvh">
      <header className="border-b border-scale bg-raised">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Logo size="sm" />
          <span className="hidden text-[13px] text-ink-soft sm:inline">{month}</span>
          <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-3">
            <ThemeToggle />
            <span className="min-w-0 truncate text-[13px] text-ink-soft">
              Workspace: {me.workspace.name}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10 lg:py-8">
        <PainelNav />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
