import type { MonthSummary } from '@finlens/contracts';
import { deltaPoints, spentShare } from '@finlens/domain';
import Link from 'next/link';
import { Scale } from '@/components/ui/scale';
import { formatCents } from '@/lib/money';
import { monthName } from '@/lib/month-label';

/** "+9 p.p. que no dia 8 de setembro" — positivo é gastar uma fatia maior da renda. */
function comparisonText(summary: MonthSummary, delta: number): string {
  const prev = monthName(summary.comparison.month);
  const when =
    summary.comparison.upToDay === null
      ? `em ${prev}`
      : `no dia ${summary.comparison.upToDay} de ${prev}`;
  if (delta === 0) return `igual ${when}`;
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta)} p.p. que ${when}`;
}

export function Headline({ summary }: { summary: MonthSummary }) {
  const net = BigInt(summary.netCents);
  const name = monthName(summary.month);
  const share = spentShare(BigInt(summary.incomeCents), BigInt(summary.expenseCents));
  const prevShare = spentShare(
    BigInt(summary.comparison.incomeCents),
    BigInt(summary.comparison.expenseCents),
  );
  const delta = deltaPoints(share, prevShare);
  const percent = share === null ? null : Math.round(share * 100);
  const comparison = delta === null ? null : comparisonText(summary, delta);
  const { warning, over } = summary.budgetAlerts;
  const alertText = [warning > 0 && `${warning} em atenção`, over > 0 && `${over} passou`]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div>
          <p className="text-[15px] text-ink-soft">
            {net < 0n ? `Faltou em ${name}` : `Sobrou em ${name}`}
          </p>
          <p
            className={`figure mt-1 text-[44px] leading-none sm:text-[56px] ${net < 0n ? 'text-mark' : ''}`}
          >
            {formatCents((net < 0n ? -net : net).toString())}
          </p>
        </div>
        <dl className="flex gap-8">
          <div>
            <dt className="text-[13px] text-ink-soft">Entrou</dt>
            <dd className="figure text-[20px]">{formatCents(summary.incomeCents)}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-ink-soft">Saiu</dt>
            <dd className="figure text-[20px]">{formatCents(summary.expenseCents)}</dd>
          </div>
        </dl>
      </div>
      {percent === null ? (
        <p className="text-ink-soft">Sem entradas neste mês.</p>
      ) : (
        <div className="space-y-2">
          <Scale
            value={percent}
            max={100}
            limit={100}
            ticks={20}
            reference={prevShare === null ? undefined : prevShare * 100}
            label="Renda gasta"
            valueText={`${percent}% da renda gasta${comparison ? `, ${comparison}` : ''}`}
          />
          <p className="text-[13px] text-ink-soft">
            <span className="font-medium text-ink">{percent}% da renda gasta</span>
            {comparison && (
              <>
                {', '}
                <span className={delta !== null && delta > 0 ? 'text-mark' : ''}>{comparison}</span>
                <span aria-hidden="true"> (marca ▾ na régua)</span>
              </>
            )}
          </p>
        </div>
      )}
      {alertText && (
        <p className="text-[13px]">
          <span className="text-ink-soft">Orçamentos: </span>
          <Link
            href="/painel/orcamentos"
            className="font-medium text-mark underline underline-offset-2"
          >
            {alertText}
          </Link>
        </p>
      )}
    </div>
  );
}
