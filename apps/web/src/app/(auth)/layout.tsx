import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Figure } from '@/components/ui/figure';
import { Panel } from '@/components/ui/panel';
import { Scale } from '@/components/ui/scale';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="Página inicial do Finlens">
            <Logo />
          </Link>
          <ThemeToggle />
        </header>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          {children}
        </main>
      </div>
      <aside
        aria-label="Exemplo do que o Finlens mostra"
        className="hidden border-l border-scale bg-raised lg:flex lg:items-center lg:justify-center lg:p-12"
      >
        <div className="w-full max-w-md">
          <p className="text-[13px] text-ink-soft">Exemplo de medida</p>
          <Panel className="mt-3 p-6">
            <Figure value="R$ 612" caption="Alimentação em outubro, de R$ 750" size="lg" />
            <Scale
              className="mt-6"
              value={612}
              max={750}
              limit={750}
              label="Orçamento de alimentação"
              valueText="R$ 612 de R$ 750"
            />
            <div className="mt-2 flex justify-between text-[13px] text-ink-soft tabular-nums">
              <span>R$ 0</span>
              <span>R$ 750</span>
            </div>
          </Panel>
          <Panel className="mt-4 p-6">
            <p className="font-medium">Seus gastos com delivery aumentaram 37% este mês.</p>
            <p className="mt-1 text-[13px] text-ink-soft">R$ 480 contra média de R$ 350.</p>
          </Panel>
        </div>
      </aside>
    </div>
  );
}
