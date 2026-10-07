import { AccountList, CategoryTree } from '@finlens/contracts';
import { todayInSaoPaulo } from '@finlens/domain';
import { ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { apiFetch } from '@/lib/api';
import { categoryOptions } from '@/lib/categories';
import { TransactionForm } from '../transaction-form';

export default async function NovaTransacaoPage() {
  const [accounts, tree] = await Promise.all([
    apiFetch('/v1/accounts', AccountList),
    apiFetch('/v1/categories', CategoryTree),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-[24px] font-semibold tracking-tight">Novo lançamento</h1>
      {accounts.length === 0 ? (
        <Panel className="max-w-xl px-6 py-8">
          <p className="font-medium">Cadastre uma conta antes de lançar</p>
          <p className="mt-1 text-ink-soft">Todo lançamento pertence a uma conta ou cartão.</p>
          <ButtonLink className="mt-4" href="/painel/contas/nova">
            Cadastrar conta
          </ButtonLink>
        </Panel>
      ) : (
        <TransactionForm
          accounts={accounts}
          groups={categoryOptions(tree)}
          today={todayInSaoPaulo()}
        />
      )}
    </div>
  );
}
