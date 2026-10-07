import { AccountList } from '@finlens/contracts';
import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { apiFetch } from '@/lib/api';
import { formatCents } from '@/lib/money';

const TYPE_LABEL = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  cash: 'Dinheiro',
  credit_card: 'Cartão de crédito',
} as const;

export default async function ContasPage() {
  const accounts = await apiFetch('/v1/accounts', AccountList);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[24px] font-semibold tracking-tight">Contas</h1>
        <ButtonLink href="/painel/contas/nova">Nova conta</ButtonLink>
      </div>
      {accounts.length === 0 ? (
        <Panel className="px-6 py-10 text-center">
          <p className="font-medium">Cadastre sua primeira conta</p>
          <p className="mt-1 text-ink-soft">
            Contas e cartões organizam seus lançamentos e saldos.
          </p>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Suas contas e cartões</caption>
            <thead className="text-[13px] text-ink-soft">
              <tr className="border-b border-scale">
                <th scope="col" className="px-5 py-3 font-normal">
                  Conta
                </th>
                <th scope="col" className="hidden px-5 py-3 font-normal sm:table-cell">
                  Tipo
                </th>
                <th scope="col" className="px-5 py-3 text-right font-normal">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-scale last:border-b-0">
                  <td className="px-5 py-4">
                    <Link href={`/painel/contas/${a.id}`} className="font-medium hover:underline">
                      {a.name}
                    </Link>
                    {a.institution && <p className="text-[13px] text-ink-soft">{a.institution}</p>}
                  </td>
                  <td className="hidden px-5 py-4 text-ink-soft sm:table-cell">
                    {TYPE_LABEL[a.type]}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {a.type === 'credit_card' ? (
                      <>
                        <p className="figure text-[18px]">
                          {formatCents(a.openInvoiceCents ?? '0')}
                        </p>
                        <p className="text-[13px] text-ink-soft">Fatura aberta</p>
                      </>
                    ) : (
                      <p className="figure text-[18px]">{formatCents(a.balanceCents ?? '0')}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
