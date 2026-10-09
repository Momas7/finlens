'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/painel', label: 'Início' },
  { href: '/painel/transacoes', label: 'Transações' },
  { href: '/painel/orcamentos', label: 'Orçamentos' },
  { href: '/painel/revisao', label: 'Revisão' },
  { href: '/painel/contas', label: 'Contas' },
  { href: '/painel/categorias', label: 'Categorias' },
];

export function PainelNav({ reviewCount }: { reviewCount: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções" className="overflow-x-auto">
      <ul className="flex gap-1 lg:flex-col">
        {ITEMS.map((item) => {
          const active =
            item.href === '/painel' ? pathname === '/painel' : pathname.startsWith(item.href);
          const count = item.href === '/painel/revisao' ? reviewCount : 0;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                aria-label={count > 0 ? `${item.label}, ${count} pendentes` : undefined}
                className={`flex items-center justify-between gap-2 rounded-[6px] px-3 py-2 text-[15px] whitespace-nowrap ${
                  active ? 'bg-raised font-medium text-ink' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {item.label}
                {count > 0 && (
                  <span
                    aria-hidden="true"
                    className="figure rounded-[4px] bg-tape px-1.5 text-[13px] leading-5 text-on-tape"
                  >
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
