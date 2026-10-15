import { InstallmentList, type InstallmentPlanItem } from '@finlens/contracts';
import Link from 'next/link';
import { Panel } from '@/components/ui/panel';
import { apiFetch } from '@/lib/api';
import { formatCents } from '@/lib/money';
import { monthLabel } from '@/lib/month-label';
import { MonthChart } from './month-chart';

function Row({ plan }: { plan: InstallmentPlanItem }) {
  const done = plan.status === 'done';
  const stale = plan.status === 'stale';
  return (
    <li className="space-y-1 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-semibold">{plan.label}</h3>
        <p className="text-[15px]">
          <span className="figure">{formatCents(plan.installmentCents)}</span>
          <span className="text-ink-soft">
            {' '}
            · parcela {plan.lastSeen} de {plan.total}
          </span>
        </p>
      </div>
      <p className="text-[13px] text-ink-soft">
        {done
          ? 'Concluído.'
          : stale
            ? `Faltam ${plan.remaining}, mas a última parcela lançada foi a ${plan.lastSeen} e já faz tempo.`
            : `Faltam ${plan.remaining}, ${formatCents(plan.remainingCents)} no total · última em ${monthLabel(plan.endDate.slice(0, 7))}.`}
      </p>
      <Link
        href={`/painel/transacoes?${new URLSearchParams({ q: plan.sampleDescription.split(' PARC')[0] ?? plan.label })}`}
        className="inline-block text-[13px] text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        Ver lançamentos<span className="sr-only"> de {plan.label}</span>
      </Link>
    </li>
  );
}

export default async function ParcelasPage() {
  const data = await apiFetch('/v1/installments', InstallmentList);
  const active = data.plans.filter((p) => p.status === 'active');
  const closed = data.plans.filter((p) => p.status !== 'active');
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Parcelas</h1>
        <p className="mt-1 text-ink-soft">
          Compras parceladas detectadas pelo texto (PARC 03/10) e o que ainda falta pagar.
        </p>
      </div>
      {data.plans.length === 0 ? (
        <Panel className="p-5">
          <p className="text-ink-soft">
            Nenhum parcelamento encontrado. Compras com PARC 03/10 no texto aparecem aqui.
          </p>
        </Panel>
      ) : (
        <>
          {active.length > 0 && (
            <p className="text-[18px]">
              <span className="font-semibold">
                {data.totals.count}{' '}
                {data.totals.count === 1 ? 'parcelamento ativo' : 'parcelamentos ativos'}
              </span>
              ,{' '}
              <span className="figure text-[22px]">{formatCents(data.totals.remainingCents)}</span>{' '}
              a pagar,{' '}
              <span className="figure text-[22px]">{formatCents(data.totals.nextMonthCents)}</span>{' '}
              no próximo mês
            </p>
          )}
          {active.length > 0 && (
            <>
              <Panel className="px-5">
                <ul aria-label="Parcelamentos ativos" className="divide-y divide-scale">
                  {active.map((p) => (
                    <Row key={p.key} plan={p} />
                  ))}
                </ul>
              </Panel>
              <Panel className="p-5">
                <MonthChart byMonth={data.byMonth} />
              </Panel>
            </>
          )}
          {closed.length > 0 && (
            <details className="rounded-[10px] border border-scale bg-raised px-5 py-3">
              <summary className="cursor-pointer text-[15px] text-ink-soft hover:text-ink">
                Encerradas ({closed.length})
              </summary>
              <ul aria-label="Parcelamentos encerrados" className="divide-y divide-scale">
                {closed.map((p) => (
                  <Row key={p.key} plan={p} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
