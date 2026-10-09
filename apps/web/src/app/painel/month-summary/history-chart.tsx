import type { MonthSummary } from '@finlens/contracts';
import Link from 'next/link';
import { formatCents } from '@/lib/money';
import { monthLabel, shortMonth } from '@/lib/month-label';

const W = 600;
const H = 140;
const SLOT = W / 6;
const BAR = 26;

export function HistoryChart({ summary }: { summary: MonthSummary }) {
  const items = summary.history;
  const max = items.reduce((m, h) => {
    const top = BigInt(h.incomeCents) > BigInt(h.expenseCents) ? h.incomeCents : h.expenseCents;
    return BigInt(top) > m ? BigInt(top) : m;
  }, 1n);
  const height = (cents: string) => (Number((BigInt(cents) * 1000n) / max) / 1000) * (H - 4);

  return (
    <section aria-labelledby="history-title" className="space-y-3">
      <h2 id="history-title" className="font-semibold">
        Últimos 6 meses
      </h2>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-36 w-full"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="stroke-scale" />
        {items.map((h, i) => {
          const x = i * SLOT + (SLOT - BAR * 2 - 4) / 2;
          const selected = h.month === summary.month;
          const inH = height(h.incomeCents);
          const outH = height(h.expenseCents);
          return (
            <g key={h.month} opacity={selected ? 1 : 0.55}>
              <rect x={x} y={H - inH} width={BAR} height={inH} className="fill-gain" />
              <rect x={x + BAR + 4} y={H - outH} width={BAR} height={outH} className="fill-tape" />
            </g>
          );
        })}
      </svg>
      <ul className="grid grid-cols-6 text-center text-[13px]">
        {items.map((h) => (
          <li key={h.month}>
            <Link
              href={`/painel?mes=${h.month}`}
              aria-label={`Painel de ${monthLabel(h.month)}`}
              aria-current={h.month === summary.month ? 'page' : undefined}
              className={`rounded-[4px] px-1.5 py-0.5 ${
                h.month === summary.month
                  ? 'font-semibold text-ink'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              {shortMonth(h.month)}
            </Link>
          </li>
        ))}
      </ul>
      <p className="flex gap-4 text-[13px] text-ink-soft" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 bg-gain" /> Entrou
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 bg-tape" /> Saiu
        </span>
      </p>
      <table className="sr-only">
        <caption>Entradas e saídas dos últimos 6 meses</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Entrou</th>
            <th scope="col">Saiu</th>
          </tr>
        </thead>
        <tbody>
          {items.map((h) => (
            <tr key={h.month}>
              <th scope="row">{monthLabel(h.month)}</th>
              <td>{formatCents(h.incomeCents)}</td>
              <td>{formatCents(h.expenseCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
