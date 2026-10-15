import { type RecurrenceItem, RecurrenceList } from '@finlens/contracts';
import Link from 'next/link';
import { Panel } from '@/components/ui/panel';
import { apiFetch } from '@/lib/api';
import { formatCents } from '@/lib/money';

const CADENCE: Record<RecurrenceItem['cadence'], string> = {
  weekly: 'semanal',
  monthly: 'mensal',
  quarterly: 'trimestral',
  annual: 'anual',
};
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
});
const shortDate = (date: string) => dateFormatter.format(new Date(`${date}T00:00:00Z`));

const badge = 'rounded-[4px] px-1.5 text-[12px] leading-5 font-medium';

function Row({ item }: { item: RecurrenceItem }) {
  const ended = item.status === 'ended';
  return (
    <li className="space-y-1 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="font-semibold">{item.label}</h2>
          {item.status === 'late' && (
            <span className={`${badge} bg-mark text-raised`}>atrasada</span>
          )}
          {item.isNew && <span className={`${badge} bg-tape text-on-tape`}>nova</span>}
        </div>
        <p className="text-[15px]">
          <span className="figure">{formatCents(item.typicalCents)}</span>
          <span className="text-ink-soft"> · {CADENCE[item.cadence]}</span>
        </p>
      </div>
      <p className="text-[13px] text-ink-soft">
        {ended
          ? `Última cobrança em ${shortDate(item.lastDate)}.`
          : item.status === 'late'
            ? `Era esperada por volta de ${shortDate(item.nextExpectedDate)} e não apareceu.`
            : `Próxima por volta de ${shortDate(item.nextExpectedDate)}.`}
        {item.priceChange && (
          <span className="font-medium text-mark">
            {' '}
            subiu de {formatCents(item.priceChange.fromCents)} para{' '}
            {formatCents(item.priceChange.toCents)}
          </span>
        )}
      </p>
      <Link
        href={`/painel/transacoes?${new URLSearchParams({ q: item.sampleDescription, from: item.firstDate })}`}
        className="inline-block text-[13px] text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        Ver lançamentos<span className="sr-only"> de {item.label}</span>
      </Link>
    </li>
  );
}

export default async function RecorrenciasPage() {
  const data = await apiFetch('/v1/recurrences', RecurrenceList);
  const running = data.items.filter((i) => i.status !== 'ended');
  const ended = data.items.filter((i) => i.status === 'ended');
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Recorrências</h1>
        <p className="mt-1 text-ink-soft">
          Cobranças que se repetem, detectadas no seu histórico de saídas.
        </p>
      </div>
      {data.items.length === 0 ? (
        <Panel className="p-5">
          <p className="text-ink-soft">
            Nenhuma cobrança recorrente encontrada. Elas aparecem quando algo se repete 3 vezes ou
            mais.
          </p>
        </Panel>
      ) : (
        <>
          {running.length > 0 && (
            <p className="text-[18px]">
              <span className="font-semibold">
                {data.totals.count}{' '}
                {data.totals.count === 1 ? 'cobrança recorrente' : 'cobranças recorrentes'}
              </span>
              , <span className="figure text-[22px]">{formatCents(data.totals.monthlyCents)}</span>{' '}
              por mês
            </p>
          )}
          {running.length > 0 && (
            <Panel className="px-5">
              <ul aria-label="Cobranças recorrentes" className="divide-y divide-scale">
                {running.map((i) => (
                  <Row key={i.key} item={i} />
                ))}
              </ul>
            </Panel>
          )}
          {ended.length > 0 && (
            <details className="rounded-[10px] border border-scale bg-raised px-5 py-3">
              <summary className="cursor-pointer text-[15px] text-ink-soft hover:text-ink">
                Encerradas ({ended.length})
              </summary>
              <ul aria-label="Cobranças encerradas" className="divide-y divide-scale">
                {ended.map((i) => (
                  <Row key={i.key} item={i} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
