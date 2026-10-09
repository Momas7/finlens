import { type Month, nextMonth, previousMonth } from '@finlens/domain';
import Link from 'next/link';
import { capitalize, monthLabel, monthName } from '@/lib/month-label';

/** "‹ Setembro · Outubro de 2026 · Novembro ›", sem avançar além do mês corrente. */
export function MonthNav({
  month,
  current,
  basePath,
}: {
  month: Month;
  current: Month;
  basePath: string;
}) {
  const prev = previousMonth(month);
  const next = nextMonth(month);
  return (
    <nav aria-label="Meses" className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
      <Link
        href={`${basePath}?mes=${prev}`}
        className="justify-self-start text-[15px] text-ink-soft hover:text-ink"
      >
        ‹ {capitalize(monthName(prev))}
      </Link>
      <p className="text-center text-[18px] font-semibold">{capitalize(monthLabel(month))}</p>
      {month < current ? (
        <Link
          href={`${basePath}?mes=${next}`}
          className="justify-self-end text-[15px] text-ink-soft hover:text-ink"
        >
          {capitalize(monthName(next))} ›
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}

/** Mês da URL (`?mes=`): inválido ou futuro cai no corrente e sinaliza o aviso. */
export function monthFromParam(
  raw: string | string[] | undefined,
  current: Month,
  parse: (text: string) => Month | null,
): { month: Month; invalid: boolean } {
  const requested = typeof raw === 'string' ? parse(raw) : null;
  const invalid = raw !== undefined && (requested === null || requested > current);
  return { month: !invalid && requested ? requested : current, invalid };
}
