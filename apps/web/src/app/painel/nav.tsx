'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/painel', label: 'Início' },
  { href: '/painel/transacoes', label: 'Transações' },
  { href: '/painel/contas', label: 'Contas' },
  { href: '/painel/categorias', label: 'Categorias' },
];

export function PainelNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções" className="overflow-x-auto">
      <ul className="flex gap-1 lg:flex-col">
        {ITEMS.map((item) => {
          const active =
            item.href === '/painel' ? pathname === '/painel' : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`block rounded-[6px] px-3 py-2 text-[15px] whitespace-nowrap ${
                  active ? 'bg-raised font-medium text-ink' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
