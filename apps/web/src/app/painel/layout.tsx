import { Review } from '@finlens/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { apiFetch, UnauthorizedError } from '@/lib/api';
import { getMe } from '@/lib/me';
import { PainelNav } from './nav';
import { SignOutButton } from './sign-out-button';

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

export default async function PainelLayout({ children }: { children: ReactNode }) {
  // O contador é acessório: falha na revisão não derruba o painel. Sessão expirada segue
  // pelo getMe, que já trata o 401.
  const [me, review] = await Promise.all([
    getMe(),
    apiFetch('/v1/review', Review).catch((err) => {
      if (err instanceof UnauthorizedError) return null;
      console.error(err);
      return null;
    }),
  ]);
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
            <Link
              href="/painel/conta"
              className="rounded-[6px] px-2 py-1.5 text-[13px] whitespace-nowrap text-ink-soft hover:text-ink"
            >
              Sua conta
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10 lg:py-8">
        <PainelNav reviewCount={(review?.counts.needsYou ?? 0) + (review?.counts.transfers ?? 0)} />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
