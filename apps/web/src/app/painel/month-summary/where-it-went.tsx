import type { MonthSummary } from '@finlens/contracts';
import { monthRange } from '@finlens/domain';
import Link from 'next/link';
import { formatCents } from '@/lib/money';

const TOP = 6;

export function WhereItWent({ summary }: { summary: MonthSummary }) {
  // "Sem categoria" fica sempre visível: é a linha que pede ação (revisar).
  const categorized = summary.categories.filter((c) => c.categoryId !== null);
  const uncategorizedRow = summary.categories.find((c) => c.categoryId === null);
  const top = [...categorized.slice(0, TOP), ...(uncategorizedRow ? [uncategorizedRow] : [])];
  const rest = categorized.slice(TOP);
  const restTotal = rest.reduce((s, c) => s + BigInt(c.expenseCents), 0n);
  const max = top.reduce((m, c) => (BigInt(c.expenseCents) > m ? BigInt(c.expenseCents) : m), 1n);
  const { from, to } = monthRange(summary.month);
  const width = (cents: bigint) => `${Math.max(1, Number((cents * 1000n) / max) / 10)}%`;

  return (
    <section aria-labelledby="where-title" className="space-y-3">
      <h2 id="where-title" className="font-semibold">
        Para onde foi
      </h2>
      {top.length === 0 ? (
        <p className="text-ink-soft">Nenhuma saída neste mês.</p>
      ) : (
        <ul className="space-y-1">
          {top.map((c) => {
            const cents = BigInt(c.expenseCents);
            const uncategorized = c.categoryId === null;
            const pending = uncategorized && summary.pendingReview > 0;
            const href = uncategorized
              ? '/painel/revisao'
              : `/painel/transacoes?categoryId=${c.categoryId}&from=${from}&to=${to}`;
            const name = `${c.label}, ${formatCents(c.expenseCents)}${pending ? `, ${summary.pendingReview} a revisar` : ''}`;
            return (
              <li key={c.categoryId ?? 'none'}>
                <Link
                  href={href}
                  aria-label={name}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_6.5rem] rounded-[6px] px-2 py-1.5 hover:bg-ink/5"
                >
                  <span className={`truncate ${uncategorized ? 'text-ink-soft' : ''}`}>
                    {c.label}
                    {pending && (
                      <span className="block text-[12px] text-ink-soft">
                        {summary.pendingReview} a revisar
                      </span>
                    )}
                  </span>
                  <span className="figure text-right text-[15px] sm:col-start-3 sm:row-start-1">
                    {formatCents(c.expenseCents)}
                  </span>
                  <span
                    className="col-span-2 h-2 border-b border-scale sm:col-span-1 sm:col-start-2 sm:row-start-1"
                    aria-hidden="true"
                  >
                    <span
                      className={`block h-2 ${uncategorized ? 'bg-scale' : 'bg-tape'}`}
                      style={{ width: width(cents) }}
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {rest.length > 0 && (
        <p className="px-2 text-[13px] text-ink-soft">
          Outras {rest.length} {rest.length === 1 ? 'categoria' : 'categorias'}:{' '}
          <span className="figure">{formatCents(restTotal.toString())}</span>
        </p>
      )}
    </section>
  );
}
