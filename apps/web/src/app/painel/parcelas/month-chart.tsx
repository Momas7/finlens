import type { InstallmentList } from '@finlens/contracts';
import { formatCents } from '@/lib/money';
import { monthLabel, shortMonth } from '@/lib/month-label';

const H = 120;
const SLOT = 44;
const BAR = 28;

/** Compromisso de cada mês: barras em SVG com a tabela equivalente para leitor de tela. */
export function MonthChart({ byMonth }: { byMonth: InstallmentList['byMonth'] }) {
  const max = byMonth.reduce((m, b) => (BigInt(b.cents) > m ? BigInt(b.cents) : m), 1n);
  const width = byMonth.length * SLOT;
  return (
    <section aria-labelledby="by-month" className="space-y-3">
      <h2 id="by-month" className="font-semibold">
        Mês a mês
      </h2>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${H + 22}`}
          width={width}
          height={H + 22}
          aria-hidden="true"
          className="max-w-none"
        >
          <line x1="0" x2={width} y1={H - 0.5} y2={H - 0.5} className="stroke-scale" />
          {byMonth.map((b, i) => {
            const h = (Number((BigInt(b.cents) * 1000n) / max) / 1000) * (H - 6);
            const x = i * SLOT + (SLOT - BAR) / 2;
            return (
              <g key={b.month}>
                <rect x={x} y={H - h} width={BAR} height={h} className="fill-tape" />
                <text
                  x={i * SLOT + SLOT / 2}
                  y={H + 15}
                  textAnchor="middle"
                  className="fill-ink-soft text-[11px]"
                >
                  {shortMonth(b.month)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <table aria-label="Compromisso mês a mês" className="sr-only">
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Parcelas</th>
          </tr>
        </thead>
        <tbody>
          {byMonth.map((b) => (
            <tr key={b.month}>
              <th scope="row">{monthLabel(b.month)}</th>
              <td>{formatCents(b.cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
