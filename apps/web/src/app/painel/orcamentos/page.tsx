import { type BudgetItem, BudgetMonth } from '@finlens/contracts';
import { parseMonth, todayInSaoPaulo } from '@finlens/domain';
import { MonthNav, monthFromParam } from '@/components/month-nav';
import { Panel } from '@/components/ui/panel';
import { Scale } from '@/components/ui/scale';
import { apiFetch } from '@/lib/api';
import { centsToInput, formatCents } from '@/lib/money';
import { monthName } from '@/lib/month-label';
import { ApplySuggestions, DefineBudget, EditBudget, RemoveBudget } from './budget-forms';

function stateText(item: BudgetItem): string {
  const spent = BigInt(item.spentCents);
  const limit = BigInt(item.limitCents as string);
  const percent = Math.round((item.share ?? 0) * 100);
  if (item.state === 'over') {
    return spent === limit
      ? '100% usado, limite atingido'
      : `Passou ${formatCents((spent - limit).toString())}`;
  }
  if (item.state === 'warning') return `${percent}%, atenção`;
  return `${percent}% usado`;
}

function paceText(item: BudgetItem): string | null {
  const p = item.pace;
  if (!p) return null;
  const parts = [`No ritmo atual, fecha em ${formatCents(p.projectedCents)}.`];
  if (p.overOnDay !== null) parts.push(`Deve passar do limite por volta do dia ${p.overOnDay}.`);
  else if (p.dailyAllowanceCents !== null) {
    parts.push(`Dá pra gastar ${formatCents(p.dailyAllowanceCents)} por dia até o fim do mês.`);
  }
  return parts.join(' ');
}

function BudgetRow({ item, editable }: { item: BudgetItem; editable: boolean }) {
  const limit = item.limitCents as string;
  const percent = Math.round((item.share ?? 0) * 100);
  const pace = paceText(item);
  return (
    <li className="space-y-2 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-semibold">{item.label}</h3>
        <p className="text-[15px]">
          <span className="figure">{formatCents(item.spentCents)}</span>
          <span className="text-ink-soft"> de </span>
          <span className="figure">{formatCents(limit)}</span>
        </p>
      </div>
      <Scale
        value={Number(item.spentCents)}
        max={Number(limit)}
        limit={Number(limit)}
        label={`Orçamento de ${item.label}`}
        valueText={`${percent}% do limite, ${formatCents(item.spentCents)} de ${formatCents(limit)}`}
      />
      <p
        className={`text-[13px] ${item.state === 'ok' ? 'text-ink-soft' : 'font-medium text-mark'}`}
      >
        {stateText(item)}
      </p>
      {pace && <p className="text-[13px] text-ink-soft">{pace}</p>}
      {editable && (
        <div className="flex flex-wrap items-start gap-1">
          <EditBudget
            categoryId={item.categoryId}
            label={item.label}
            current={centsToInput(limit)}
          />
          <RemoveBudget categoryId={item.categoryId} label={item.label} />
        </div>
      )}
    </li>
  );
}

function UnbudgetedRow({ item }: { item: BudgetItem }) {
  return (
    <li className="space-y-2 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="font-semibold">{item.label}</h3>
        <p className="text-[13px] text-ink-soft">
          Gasto no mês <span className="figure text-ink">{formatCents(item.spentCents)}</span>
        </p>
      </div>
      <DefineBudget
        categoryId={item.categoryId}
        label={item.label}
        defaultValue={item.suggestion ? centsToInput(item.suggestion.amountCents) : ''}
        hint={
          item.suggestion
            ? `Sugestão: ${formatCents(item.suggestion.amountCents)}, mediana de ${item.suggestion.months} meses`
            : undefined
        }
      />
    </li>
  );
}

export default async function OrcamentosPage({ searchParams }: PageProps<'/painel/orcamentos'>) {
  const params = await searchParams;
  const current = todayInSaoPaulo().slice(0, 7);
  const { month, invalid } = monthFromParam(params.mes, current, parseMonth);
  const data = await apiFetch(`/v1/budgets?month=${month}`, BudgetMonth);
  const withLimit = data.items.filter((i) => i.limitCents !== null);
  const withoutLimit = data.items.filter((i) => i.limitCents === null);
  const suggested = withoutLimit.filter((i) => i.suggestion);
  // Sem gasto e sem sugestão ficam recolhidas, para a lista não esconder o que importa.
  const featured = withoutLimit.filter((i) => i.suggestion || BigInt(i.spentCents) > 0n);
  const quiet = withoutLimit.filter((i) => !featured.includes(i));
  const budgeted = BigInt(data.totals.budgetedCents);
  const spent = BigInt(data.totals.spentCents);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">
          Orçamentos de {monthName(month)}
        </h1>
        <p className="mt-1 text-ink-soft">
          Um limite mensal por categoria. Mudanças valem a partir do mês atual.
        </p>
      </div>
      <MonthNav month={month} current={current} basePath="/painel/orcamentos" />
      {invalid && (
        <p role="status" className="text-[13px] text-ink-soft">
          Mês inválido, mostrando {monthName(month)}
        </p>
      )}
      {!data.editable && (
        <p className="text-[13px] text-ink-soft">Orçamentos de meses passados não mudam.</p>
      )}

      {budgeted > 0n && (
        <Panel className="space-y-2 p-5">
          <p className="text-[15px]">
            <span className="figure text-[20px]">{formatCents(spent.toString())}</span>
            <span className="text-ink-soft"> de </span>
            <span className="figure text-[20px]">{formatCents(budgeted.toString())}</span>
            <span className="text-ink-soft"> orçados</span>
          </p>
          <Scale
            value={Number(spent)}
            max={Number(budgeted)}
            limit={Number(budgeted)}
            ticks={20}
            label="Total orçado"
            valueText={`${formatCents(spent.toString())} de ${formatCents(budgeted.toString())}`}
          />
        </Panel>
      )}

      {withLimit.length > 0 ? (
        <Panel as="section" aria-labelledby="with-budget" className="px-5 pt-5 pb-1">
          <h2 id="with-budget" className="font-semibold">
            Com orçamento
          </h2>
          <ul className="divide-y divide-scale">
            {withLimit.map((item) => (
              <BudgetRow key={item.categoryId} item={item} editable={data.editable} />
            ))}
          </ul>
        </Panel>
      ) : (
        data.editable && (
          <Panel className="space-y-4 p-5">
            <p className="text-ink-soft">
              Defina um limite mensal para as categorias que você quer acompanhar.
            </p>
            {suggested.length > 0 && (
              <ApplySuggestions
                summary={suggested
                  .map((i) => `${i.label}: ${formatCents(i.suggestion?.amountCents as string)}`)
                  .join('\n')}
              />
            )}
          </Panel>
        )
      )}

      {data.editable && withoutLimit.length > 0 && (
        <Panel as="section" aria-labelledby="without-budget" className="px-5 pt-5 pb-1">
          <h2 id="without-budget" className="font-semibold">
            Sem orçamento
          </h2>
          <ul className="divide-y divide-scale">
            {(featured.length > 0 ? featured : withoutLimit).map((item) => (
              <UnbudgetedRow key={item.categoryId} item={item} />
            ))}
          </ul>
          {featured.length > 0 && quiet.length > 0 && (
            <details className="border-t border-scale py-3">
              <summary className="cursor-pointer text-[15px] text-ink-soft hover:text-ink">
                Outras categorias ({quiet.length})
              </summary>
              <ul className="divide-y divide-scale">
                {quiet.map((item) => (
                  <UnbudgetedRow key={item.categoryId} item={item} />
                ))}
              </ul>
            </details>
          )}
        </Panel>
      )}
    </div>
  );
}
