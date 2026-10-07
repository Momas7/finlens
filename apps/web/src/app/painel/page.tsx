import { AccountList } from '@finlens/contracts';
import { LogoMark } from '@/components/logo';
import { ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { apiFetch } from '@/lib/api';
import { getMe } from '@/lib/me';

export default async function PainelPage() {
  const [me, accounts] = await Promise.all([getMe(), apiFetch('/v1/accounts', AccountList)]);
  const hasAccounts = accounts.length > 0;
  return (
    <div className="space-y-8">
      <h1
        className="truncate text-[32px] font-semibold tracking-tight"
        style={{ fontStretch: '85%' }}
      >
        Olá, {me.user.name}
      </h1>
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
    </div>
  );
}
