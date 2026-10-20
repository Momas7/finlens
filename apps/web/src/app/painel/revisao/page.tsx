import {
  CategoryTree,
  LlmStatus,
  Review,
  type ReviewGroup,
  RuleSuggestionList,
  TransferSuggestionList,
} from '@finlens/contracts';
import Link from 'next/link';
import { Panel } from '@/components/ui/panel';
import { Scale } from '@/components/ui/scale';
import { apiFetch } from '@/lib/api';
import { type CategoryOption, categoryLabels, categoryOptions } from '@/lib/categories';
import { formatCents } from '@/lib/money';
import { groupHeadingId } from '@/lib/review';
import { GroupForm } from './group-form';
import { RuleSuggestionItem } from './rule-suggestion';
import { TransferSuggestionItem } from './transfer-suggestions';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
});

function GroupItem({
  section,
  group,
  labels,
  groups,
  aiEnabled,
}: {
  section: string;
  group: ReviewGroup;
  labels: Map<string, string>;
  groups: { group: string; options: CategoryOption[] }[];
  aiEnabled: boolean;
}) {
  const percent = group.confidence === null ? null : Math.round(group.confidence * 100);
  const suggested = group.suggestedCategoryId && labels.get(group.suggestedCategoryId);
  const headingId = groupHeadingId(section, group.key);
  return (
    <li aria-labelledby={headingId} className="space-y-3 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={headingId} className="font-semibold break-all">
          {group.label}
        </h3>
        <p className="text-[13px] text-ink-soft">
          {group.count} {group.count === 1 ? 'lançamento' : 'lançamentos'} ·{' '}
          <span className="figure text-ink">{formatCents(group.totalCents)}</span> · último em{' '}
          {dateFormatter.format(new Date(`${group.latestDate}T00:00:00Z`))}
        </p>
      </div>
      {suggested && percent !== null && (
        <div className="space-y-1 text-[13px]">
          <p>
            <span className="text-ink-soft">Sugestão: </span>
            <span className="font-medium">{suggested}</span>
            <span className="figure ml-2 text-[15px]">{percent}%</span>
          </p>
          <Scale
            className="max-w-[12rem]"
            value={percent}
            max={100}
            ticks={10}
            label={`Confiança da sugestão para ${group.label}`}
            valueText={`${percent}%`}
          />
        </div>
      )}
      <GroupForm group={group} groups={groups} aiEnabled={aiEnabled} />
      <Link
        href={`/painel/transacoes?q=${encodeURIComponent(group.label)}`}
        className="inline-block text-[13px] text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        Ver lançamentos<span className="sr-only"> de {group.label}</span>
      </Link>
    </li>
  );
}

function GroupSection({
  id,
  title,
  hint,
  list,
  labels,
  groups,
  aiEnabled,
}: {
  id: string;
  title: string;
  hint: string;
  list: ReviewGroup[];
  labels: Map<string, string>;
  groups: { group: string; options: CategoryOption[] }[];
  aiEnabled: boolean;
}) {
  if (list.length === 0) return null;
  return (
    <Panel as="section" aria-labelledby={id} className="px-5 pt-5 pb-1">
      <h2 id={id} className="font-semibold">
        {title}
      </h2>
      <p className="mt-1 text-[13px] text-ink-soft">{hint}</p>
      <ul className="divide-y divide-scale">
        {list.map((g) => (
          <GroupItem
            key={g.key}
            section={id}
            group={g}
            labels={labels}
            groups={groups}
            aiEnabled={aiEnabled}
          />
        ))}
      </ul>
    </Panel>
  );
}

export default async function RevisaoPage() {
  const [review, suggestions, transfers, tree, llm] = await Promise.all([
    apiFetch('/v1/review', Review),
    apiFetch('/v1/rule-suggestions', RuleSuggestionList),
    apiFetch('/v1/transfers/suggestions', TransferSuggestionList),
    apiFetch('/v1/categories', CategoryTree),
    apiFetch('/v1/llm/status', LlmStatus),
  ]);
  const labels = categoryLabels(tree);
  const groups = categoryOptions(tree);
  const empty =
    review.needsYou.length === 0 && review.likely.length === 0 && transfers.length === 0;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Revisão</h1>
        <p className="mt-1 text-ink-soft">
          Lançamentos parecidos aparecem juntos. Confirmar ensina o Finlens a acertar os próximos.
        </p>
      </div>

      {transfers.length > 0 && (
        <Panel as="section" aria-labelledby="transfer-suggestions" className="px-5 pt-5 pb-2">
          <h2 id="transfer-suggestions" className="font-semibold">
            Transferências a confirmar
          </h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            Duas pontas com valores iguais e opostos. Confirmadas, saem de gastos e receitas.
          </p>
          <ul className="divide-y divide-scale">
            {transfers.map((t) => (
              <TransferSuggestionItem key={t.id} suggestion={t} />
            ))}
          </ul>
        </Panel>
      )}

      {suggestions.length > 0 && (
        <Panel as="section" aria-labelledby="rule-suggestions" className="px-5 pt-5 pb-2">
          <h2 id="rule-suggestions" className="font-semibold">
            Regras sugeridas
          </h2>
          <ul className="divide-y divide-scale">
            {suggestions.map((s) => (
              <RuleSuggestionItem key={s.id} suggestion={s} />
            ))}
          </ul>
        </Panel>
      )}

      {empty ? (
        <Panel className="p-5">
          <p className="text-ink-soft">
            Tudo revisado. Novos lançamentos com dúvida aparecem aqui.
          </p>
        </Panel>
      ) : (
        <>
          <GroupSection
            id="needs-you"
            title="Precisam de você"
            hint="Sem categoria ou com sugestão de pouca confiança."
            list={review.needsYou}
            labels={labels}
            groups={groups}
            aiEnabled={llm.enabled}
          />
          <GroupSection
            id="likely"
            title="Prováveis"
            hint="Já classificados, com confiança média. Confirme para o Finlens aprender."
            list={review.likely}
            labels={labels}
            groups={groups}
            aiEnabled={false}
          />
        </>
      )}
    </div>
  );
}
