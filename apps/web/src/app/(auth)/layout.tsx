import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-2xl font-semibold tracking-tight">Finlens</p>
          <ThemeToggle />
        </div>
        {children}
      </div>
    </main>
  );
}
