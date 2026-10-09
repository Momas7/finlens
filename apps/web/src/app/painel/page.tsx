import { AccountList, MonthSummary } from '@finlens/contracts';
import { nextMonth, parseMonth, previousMonth, todayInSaoPaulo } from '@finlens/domain';
import Link from 'next/link';
import { LogoMark } from '@/components/logo';
import { ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { apiFetch, UnauthorizedError } from '@/lib/api';
import { getMe } from '@/lib/me';
import { capitalize, monthLabel, monthName } from '@/lib/month-label';
import { Headline } from './month-summary/headline';
import { HistoryChart } from './month-summary/history-chart';
import { WhereItWent } from './month-summary/where-it-went';

function Invite({ hasAccounts }: { hasAccounts: boolean }) {
  return (
    <Panel as="section" aria-labelledby="empty-title" className="px-6 py-12 text-center sm:px-12">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <span className="text-ink-soft">
          <LogoMark size={32} />
        </span>
        <h2 id="empty-title" className="mt-4 text-[18px] font-semibold">
          {hasAccounts ? 'Lance suas primeiras transações' : 'Cadastre sua primeira conta'}
        </h2>
        <p className="mt-2 text-ink-soft">
          {hasAccounts
            ? 'Registre gastos e entradas para ver para onde vai seu dinheiro.'
            : 'Contas e cartões organizam seus lançamentos e saldos.'}
        </p>
        <ButtonLink
          className="mt-6"
          href={hasAccounts ? '/painel/transacoes/nova' : '/painel/contas/nova'}
        >
          {hasAccounts ? 'Lançar transação' : 'Cadastrar conta'}
        </ButtonLink>
        <p className="mt-3 text-[13px] text-ink-soft">
          Importação de extratos chega na próxima fase.
        </p>
      </div>
    </Panel>
  );
}

export default async function PainelPage({ searchParams }: PageProps<'/painel'>) {
  const params = await searchParams;
  const current = todayInSaoPaulo().slice(0, 7);
  const requested = typeof params.mes === 'string' ? parseMonth(params.mes) : null;
  const invalid = params.mes !== undefined && (requested === null || requested > current);
  const month = !invalid && requested ? requested : current;

  const [me, accounts, summary] = await Promise.all([
    getMe(),
    apiFetch('/v1/accounts', AccountList),
    apiFetch(`/v1/analytics/month?month=${month}`, MonthSummary).catch((err) => {
      if (err instanceof UnauthorizedError) throw err;
      console.error(err);
      return null;
    }),
  ]);
  const hasAccounts = accounts.length > 0;
  const neverUsed =
    summary?.isCurrent &&
    summary.history.every((h) => h.incomeCents === '0' && h.expenseCents === '0');
  const emptyMonth =
    summary !== null && summary.incomeCents === '0' && summary.expenseCents === '0';

  return (
    <div className="space-y-8">
      <h1
        className="truncate text-[32px] font-semibold tracking-tight"
        style={{ fontStretch: '85%' }}
      >
        Olá, {me.user.name}
      </h1>
      {invalid && (
        <p role="status" className="text-[13px] text-ink-soft">
          Mês inválido, mostrando {monthName(month)}
        </p>
      )}
      {!hasAccounts || neverUsed ? (
        <Invite hasAccounts={hasAccounts} />
      ) : (
        <>
          <nav aria-label="Meses" className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <Link
              href={`/painel?mes=${previousMonth(month)}`}
              className="justify-self-start text-[15px] text-ink-soft hover:text-ink"
            >
              ‹ {capitalize(monthName(previousMonth(month)))}
            </Link>
            <p className="text-center text-[18px] font-semibold">{capitalize(monthLabel(month))}</p>
            {month < current ? (
              <Link
                href={`/painel?mes=${nextMonth(month)}`}
                className="justify-self-end text-[15px] text-ink-soft hover:text-ink"
              >
                {capitalize(monthName(nextMonth(month)))} ›
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
          </nav>
          {summary === null ? (
            <Panel className="p-6">
              <p className="text-ink-soft">Não foi possível carregar o resumo agora.</p>
            </Panel>
          ) : (
            <>
              <Panel as="section" aria-label="Resumo do mês" className="p-6 sm:p-8">
                {emptyMonth ? (
                  <p className="text-ink-soft">Nada lançado em {monthName(month)}.</p>
                ) : (
                  <Headline summary={summary} />
                )}
              </Panel>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
                {!emptyMonth && (
                  <Panel className="p-5">
                    <WhereItWent summary={summary} />
                  </Panel>
                )}
                <Panel className={`p-5 ${emptyMonth ? 'lg:col-span-2' : ''}`}>
                  <HistoryChart summary={summary} />
                </Panel>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
