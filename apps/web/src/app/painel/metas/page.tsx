import { AccountList, type Goal, GoalList } from '@finlens/contracts';
import { ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Scale } from '@/components/ui/scale';
import { apiFetch } from '@/lib/api';
import { formatCents } from '@/lib/money';
import { monthLabel } from '@/lib/month-label';
import { ArchiveGoal, EditGoal, NewGoalForm } from './goal-forms';

function forecast(goal: Goal): string {
  if (goal.monthlyPaceCents === null)
    return 'Ainda sem ritmo: precisa de um mês fechado nesta conta.';
  if (goal.projectedMonth === null) return 'No ritmo atual, não chega lá.';
  return `No ritmo atual (${formatCents(goal.monthlyPaceCents)} por mês), chega lá em ${monthLabel(goal.projectedMonth)}.`;
}

function plan(goal: Goal): string | null {
  if (!goal.targetDate) return null;
  if (goal.requiredMonthlyCents === null) return 'A data passou.';
  if (goal.requiredMonthlyCents === '0') return 'Só o rendimento já chega lá.';
  return `Para chegar em ${monthLabel(goal.targetDate.slice(0, 7))}, guarde ${formatCents(goal.requiredMonthlyCents)} por mês.`;
}

function GoalCard({ goal }: { goal: Goal }) {
  const done = goal.status === 'done';
  const headingId = `goal-${goal.id}`;
  const percent = Math.floor(goal.progress * 100);
  const planText = done ? null : plan(goal);
  return (
    <Panel as="section" aria-labelledby={headingId} className="space-y-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={headingId} className="text-[18px] font-semibold">
          {goal.name}
        </h2>
        {done ? (
          <span className="rounded-[4px] bg-gain px-2 text-[13px] leading-6 font-medium text-raised">
            Concluída
          </span>
        ) : (
          <span className="text-[13px] text-ink-soft">{goal.accountName}</span>
        )}
      </div>
      <p className="text-[15px]">
        <span className="figure text-[22px]">{formatCents(goal.balanceCents)}</span>
        <span className="text-ink-soft"> de </span>
        <span className="figure text-[22px]">{formatCents(goal.targetCents)}</span>
        {!done && (
          <span className="text-ink-soft">, faltam {formatCents(goal.remainingCents)}</span>
        )}
      </p>
      <Scale
        value={Math.max(0, Number(goal.balanceCents))}
        max={Number(goal.targetCents)}
        ticks={20}
        label={`Progresso de ${goal.name}`}
        valueText={`${percent}% do alvo, ${formatCents(goal.balanceCents)} de ${formatCents(goal.targetCents)}`}
      />
      {!done && (
        <div className="space-y-1 text-[13px] text-ink-soft">
          <p>{forecast(goal)}</p>
          {planText && <p className="font-medium text-ink">{planText}</p>}
          {goal.status === 'behind' && goal.delayMonths !== null && (
            <p className="font-medium text-mark">
              {goal.delayMonths === 1 ? '1 mês' : `${goal.delayMonths} meses`} depois do planejado.
            </p>
          )}
          {goal.status === 'on_track' && <p className="font-medium text-gain">No prazo.</p>}
        </div>
      )}
      <div className="flex flex-wrap items-start gap-1">
        <EditGoal goal={goal} />
        <ArchiveGoal id={goal.id} name={goal.name} />
      </div>
    </Panel>
  );
}

export default async function MetasPage() {
  const [goals, accounts] = await Promise.all([
    apiFetch('/v1/goals', GoalList),
    apiFetch('/v1/accounts', AccountList),
  ]);
  const taken = new Set(goals.map((g) => g.accountId));
  const eligible = accounts.filter(
    (a) => a.type !== 'credit_card' && !a.archived && !taken.has(a.id),
  );
  const hasEligibleType = accounts.some((a) => a.type !== 'credit_card' && !a.archived);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Metas</h1>
        <p className="mt-1 text-ink-soft">
          Cada meta acompanha o saldo de uma conta. Depositou nela, a meta anda.
        </p>
      </div>

      {goals.length === 0 ? (
        <p className="text-ink-soft">Nenhuma meta ainda.</p>
      ) : (
        <div className="space-y-4">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>
      )}

      <Panel as="section" aria-labelledby="new-goal" className="p-5">
        <h2 id="new-goal" className="mb-4 font-semibold">
          Nova meta
        </h2>
        {eligible.length > 0 ? (
          <NewGoalForm accounts={eligible.map((a) => ({ id: a.id, name: a.name }))} />
        ) : (
          <div className="space-y-3">
            <p className="text-ink-soft">
              {hasEligibleType
                ? 'Todas as suas contas já têm uma meta. Cadastre outra conta para uma meta nova.'
                : 'Cadastre uma conta poupança para acompanhar uma meta.'}
            </p>
            <ButtonLink href="/painel/contas/nova" variant="secondary" size="sm">
              Cadastrar conta
            </ButtonLink>
          </div>
        )}
      </Panel>
    </div>
  );
}
