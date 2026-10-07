import { AccountList, CategoryTree, TransactionPage } from '@finlens/contracts';
import Link from 'next/link';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { categoryLabels, categoryOptions } from '@/lib/categories';
import { formatCents } from '@/lib/money';

const FILTERS = ['q', 'accountId', 'categoryId', 'from', 'to'] as const;
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export default async function TransacoesPage({ searchParams }: PageProps<'/painel/transacoes'>) {
  const params = await searchParams;
  const filters = new URLSearchParams();
  for (const key of FILTERS) {
    const value = params[key];
    if (typeof value === 'string' && value.trim() !== '') filters.set(key, value.trim());
  }
  const query = new URLSearchParams(filters);
  if (typeof params.cursor === 'string') query.set('cursor', params.cursor);

  const [page, accounts, tree] = await Promise.all([
    apiFetch(`/v1/transactions?${query}`, TransactionPage),
    apiFetch('/v1/accounts', AccountList),
    apiFetch('/v1/categories', CategoryTree),
  ]);
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const labels = categoryLabels(tree);
  const nextHref = page.nextCursor
    ? `/painel/transacoes?${new URLSearchParams({ ...Object.fromEntries(filters), cursor: page.nextCursor })}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[24px] font-semibold tracking-tight">Transações</h1>
        <ButtonLink href="/painel/transacoes/nova">Novo lançamento</ButtonLink>
      </div>

      <search aria-label="Filtrar transações">
        <form
          method="get"
          className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end"
        >
          <Field
            className="col-span-2 lg:col-span-1"
            label="Buscar"
            name="q"
            type="search"
            defaultValue={filters.get('q') ?? ''}
          />
          <Select label="Conta" name="accountId" defaultValue={filters.get('accountId') ?? ''}>
            <option value="">Todas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select
            label="Categoria"
            name="categoryId"
            defaultValue={filters.get('categoryId') ?? ''}
          >
            <option value="">Todas</option>
            {categoryOptions(tree).map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          <Field label="De" name="from" type="date" defaultValue={filters.get('from') ?? ''} />
          <Field label="Até" name="to" type="date" defaultValue={filters.get('to') ?? ''} />
          <Button type="submit" variant="secondary" className="col-span-2 h-11 lg:col-span-1">
            Filtrar
          </Button>
        </form>
      </search>

      {page.items.length === 0 ? (
        <Panel className="px-6 py-10 text-center">
          <p className="font-medium">
            {filters.size > 0 ? 'Nenhum lançamento com esses filtros' : 'Nenhum lançamento ainda'}
          </p>
          <p className="mt-1 text-ink-soft">
            {filters.size > 0
              ? 'Ajuste ou limpe os filtros para ver mais.'
              : 'Registre um gasto ou uma entrada para começar.'}
          </p>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Lançamentos</caption>
            <thead className="text-[13px] text-ink-soft">
              <tr className="border-b border-scale">
                <th scope="col" className="hidden px-5 py-3 font-normal sm:table-cell">
                  Data
                </th>
                <th scope="col" className="px-5 py-3 font-normal">
                  Descrição
                </th>
                <th scope="col" className="hidden px-5 py-3 font-normal md:table-cell">
                  Categoria
                </th>
                <th scope="col" className="hidden px-5 py-3 font-normal lg:table-cell">
                  Conta
                </th>
                <th scope="col" className="px-5 py-3 text-right font-normal">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((t) => {
                const income = !t.amountCents.startsWith('-');
                return (
                  <tr key={t.id} className="border-b border-scale last:border-b-0">
                    <td className="hidden px-5 py-3.5 whitespace-nowrap text-ink-soft tabular-nums sm:table-cell">
                      {dateFormatter.format(new Date(`${t.postedDate}T00:00:00Z`))}
                    </td>
                    <td className="max-w-[16rem] min-w-0 px-5 py-3.5">
                      <Link
                        href={`/painel/transacoes/${t.id}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {t.description}
                      </Link>
                      <p className="text-[13px] text-ink-soft tabular-nums sm:hidden">
                        {dateFormatter.format(new Date(`${t.postedDate}T00:00:00Z`))}
                      </p>
                    </td>
                    <td className="hidden px-5 py-3.5 text-ink-soft md:table-cell">
                      {t.categoryId ? labels.get(t.categoryId) : 'Sem categoria'}
                    </td>
                    <td className="hidden px-5 py-3.5 text-ink-soft lg:table-cell">
                      {accountNames.get(t.accountId)}
                    </td>
                    <td
                      className={`px-5 py-3.5 text-right whitespace-nowrap figure text-[17px] ${income ? 'text-gain' : ''}`}
                    >
                      {formatCents(t.amountCents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}
      {nextHref && (
        <div className="flex justify-center">
          <ButtonLink href={nextHref} variant="secondary">
            Ver lançamentos mais antigos
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
