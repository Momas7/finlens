import { AccountList, CategoryTree, Transaction } from '@finlens/contracts';
import { todayInSaoPaulo } from '@finlens/domain';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { categoryLabels, categoryOptions } from '@/lib/categories';
import { TransactionForm } from '../transaction-form';
import { DeleteTransactionButton } from './delete-button';
import { UnlinkButton } from './unlink-button';
import { WhyPanel } from './why-panel';

export default async function EditarTransacaoPage({
  params,
}: PageProps<'/painel/transacoes/[id]'>) {
  const { id } = await params;
  const [transaction, accounts, tree] = await Promise.all([
    apiFetch(`/v1/transactions/${encodeURIComponent(id)}`, Transaction).catch(() => null),
    apiFetch('/v1/accounts?includeArchived=true', AccountList),
    apiFetch('/v1/categories', CategoryTree),
  ]);
  if (!transaction) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-[24px] font-semibold tracking-tight">Editar lançamento</h1>
      <TransactionForm
        accounts={accounts}
        groups={categoryOptions(tree)}
        today={todayInSaoPaulo()}
        transaction={transaction}
        currentCategoryLabel={
          transaction.categoryId
            ? (categoryLabels(tree).get(transaction.categoryId) ?? 'Categoria arquivada')
            : undefined
        }
      />
      <WhyPanel
        transaction={transaction}
        categoryLabel={
          categoryLabels(tree).get(
            transaction.categoryId ?? transaction.suggestedCategoryId ?? '',
          ) ?? null
        }
      />
      {transaction.transfer && (
        <div className="max-w-xl space-y-2 border-t border-scale pt-6">
          <p className="text-[15px] text-ink-soft">
            Este lançamento é{' '}
            {transaction.transfer.kind === 'card_payment'
              ? 'um pagamento de fatura'
              : 'uma transferência'}{' '}
            com {transaction.transfer.withAccount} e fica fora de gastos e receitas.
          </p>
          <UnlinkButton id={transaction.id} withAccount={transaction.transfer.withAccount} />
        </div>
      )}
      <div className="max-w-xl border-t border-scale pt-6">
        <DeleteTransactionButton id={transaction.id} />
      </div>
    </div>
  );
}
