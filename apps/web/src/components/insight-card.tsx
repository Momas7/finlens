import type { Insight } from '@finlens/contracts';
import { ButtonLink } from '@/components/ui/button';
import { DismissInsight } from './dismiss-insight';

/** Cartão de insight: fita lateral marca a severidade (atenção em vermelho, informativo neutro). */
export function InsightCard({ insight }: { insight: Insight }) {
  const warning = insight.severity === 'warning';
  return (
    <li className="relative overflow-hidden rounded-[8px] border border-scale bg-raised py-4 pr-4 pl-6">
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1.5 ${warning ? 'bg-mark' : 'bg-ink-soft/50'}`}
      />
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="font-semibold">
          <span className="sr-only">{warning ? 'Atenção: ' : 'Para saber: '}</span>
          {insight.title}
        </h3>
        {insight.isNew && (
          <span className="rounded-[4px] bg-tape px-1.5 text-[12px] leading-5 font-medium text-on-tape">
            novo
          </span>
        )}
      </div>
      <p className="mt-1 text-[15px] text-ink-soft">{insight.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {insight.action && (
          <ButtonLink href={insight.action.href} size="sm" variant="secondary">
            {insight.action.label}
            <span className="sr-only">: {insight.title}</span>
          </ButtonLink>
        )}
        <DismissInsight id={insight.id} title={insight.title} />
      </div>
    </li>
  );
}
