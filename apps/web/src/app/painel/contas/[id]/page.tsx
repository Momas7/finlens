import { AccountList } from '@finlens/contracts';
import { todayInSaoPaulo } from '@finlens/domain';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { AccountForm } from '../account-form';
import { ArchiveAccountButton } from './archive-button';

export default async function EditarContaPage({ params }: PageProps<'/painel/contas/[id]'>) {
  const { id } = await params;
  const account = (await apiFetch('/v1/accounts', AccountList)).find((a) => a.id === id);
  if (!account) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-[24px] font-semibold tracking-tight">{account.name}</h1>
      <AccountForm account={account} today={todayInSaoPaulo()} />
      <div className="max-w-md border-t border-scale pt-6">
        <ArchiveAccountButton id={account.id} />
      </div>
    </div>
  );
}
