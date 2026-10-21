'use client';

import type { Account } from '@finlens/contracts';
import { type FormEvent, startTransition, useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { accountLabel } from '@/lib/accounts';
import { formatCents } from '@/lib/money';
import { type CommitState, commitStatement, type ImportState, previewStatement } from './actions';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const SHOWN_NEW = 200;
const SHOWN_REPEATED = 50;

type Row = { postedDate: string; description: string; amountCents: string; status: string };

function RowsTable({ caption, rows }: { caption: string; rows: Row[] }) {
  return (
    <table className="w-full text-left text-[14px]">
      <caption className="sr-only">{caption}</caption>
      <thead className="text-[13px] text-ink-soft">
        <tr>
          <th scope="col" className="py-2 pr-3 font-medium">
            Data
          </th>
          <th scope="col" className="py-2 pr-3 font-medium">
            Descrição
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Valor
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-scale">
        {rows.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: linhas iguais são possíveis e a lista é estática
          <tr key={i}>
            <td className="py-2 pr-3 whitespace-nowrap">
              {dateFormatter.format(new Date(`${r.postedDate}T00:00:00Z`))}
            </td>
            <td className="py-2 pr-3 break-all">{r.description}</td>
            <td className="figure py-2 text-right whitespace-nowrap">
              {formatCents(r.amountCents)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Preview({
  preview,
  onBack,
}: {
  preview: NonNullable<ImportState['preview']>;
  onBack: () => void;
}) {
  const [state, action, pending] = useActionState<CommitState, FormData>(commitStatement, {});
  const { summary } = preview;
  const fresh = preview.rows.filter((r) => r.status === 'new');
  const repeated = preview.rows.filter((r) => r.status !== 'new');
  return (
    <div className="space-y-6">
      <Panel className="space-y-2 p-5">
        <h2 className="font-semibold">Prévia da importação</h2>
        <p role="status">
          {summary.total} {summary.total === 1 ? 'lançamento' : 'lançamentos'} no arquivo:{' '}
          <strong>{summary.new} novos</strong>, {summary.imported} já importados, {summary.existing}{' '}
          já existem (lançados à mão)
          {summary.payments > 0 && `, ${summary.payments} pagamentos de fatura`}
          {summary.ignored > 0 && `. ${summary.ignored} linhas ilegíveis foram ignoradas`}.
        </p>
        <p className="text-[13px] text-ink-soft">Nada foi gravado ainda.</p>
        <form action={action} className="flex flex-wrap items-center gap-3 pt-2">
          <input type="hidden" name="batchId" value={preview.batchId} />
          <Button type="submit" disabled={pending || summary.new === 0}>
            Importar {summary.new}
          </Button>
          <Button type="button" variant="ghost" onClick={onBack}>
            Escolher outro arquivo
          </Button>
          {state.error && (
            <p role="alert" className="basis-full text-[13px] text-mark">
              {state.error}
            </p>
          )}
        </form>
      </Panel>

      {fresh.length > 0 && (
        <Panel as="section" aria-labelledby="import-new" className="px-5 pt-5 pb-3">
          <h2 id="import-new" className="font-semibold">
            Lançamentos novos
          </h2>
          <RowsTable caption="Lançamentos novos" rows={fresh.slice(0, SHOWN_NEW)} />
          {fresh.length > SHOWN_NEW && (
            <p className="py-2 text-[13px] text-ink-soft">
              E mais {fresh.length - SHOWN_NEW}, que também serão importados.
            </p>
          )}
        </Panel>
      )}

      {repeated.length > 0 && (
        <Panel as="section" aria-labelledby="import-repeated" className="px-5 pt-5 pb-3">
          <h2 id="import-repeated" className="font-semibold">
            Não serão importados
          </h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            Já importados antes ou iguais a um lançamento seu.
          </p>
          <RowsTable
            caption="Lançamentos que não serão importados"
            rows={repeated.slice(0, SHOWN_REPEATED)}
          />
        </Panel>
      )}
    </div>
  );
}

export function ImportFlow({ accounts }: { accounts: Account[] }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(previewStatement, {});
  const [dismissed, setDismissed] = useState<unknown>(null);
  const fields = state.fieldErrors ?? {};
  const mapping = state.needsMapping;

  // Enviar por aqui mantém o arquivo escolhido quando a ação pede o mapeamento.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }

  if (state.preview && dismissed !== state.preview) {
    return <Preview preview={state.preview} onBack={() => setDismissed(state.preview)} />;
  }

  const columns = mapping?.headers.map((h, i) => ({
    value: String(i),
    label: h || `Coluna ${i + 1}`,
  }));
  return (
    <form action={action} onSubmit={onSubmit} className="max-w-xl space-y-5" noValidate>
      <Select
        label="Conta"
        name="accountId"
        error={fields.accountId}
        defaultValue={accounts[0]?.id}
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {accountLabel(a)}
          </option>
        ))}
      </Select>
      <Field
        label="Arquivo do extrato"
        name="file"
        type="file"
        accept=".csv,.ofx,.txt,text/csv"
        hint="CSV ou OFX, até 5 MB. A fatura do cartão Inter em CSV já é reconhecida."
        error={fields.file}
      />

      {mapping && columns && (
        <fieldset className="space-y-4 rounded-[6px] border border-scale p-4">
          <legend className="px-1 text-[13px] font-medium">Não reconheci este formato</legend>
          <p className="text-[13px] text-ink-soft">
            Diga onde está cada informação. Primeira linha do arquivo: {mapping.headers.join(' · ')}
            {mapping.sample[0] && `. Exemplo: ${mapping.sample[0].join(' · ')}`}.
          </p>
          <Select label="Coluna da data" name="mapDate" defaultValue="0">
            {columns.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select
            label="Coluna da descrição"
            name="mapDescription"
            defaultValue={columns[1] ? '1' : '0'}
          >
            {columns.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select label="Coluna do valor" name="mapAmount" defaultValue={columns[2] ? '2' : '0'}>
            {columns.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select label="Formato da data" name="mapDateFormat" defaultValue="dd/MM/yyyy">
            <option value="dd/MM/yyyy">dd/mm/aaaa</option>
            <option value="yyyy-MM-dd">aaaa-mm-dd</option>
            <option value="MM/dd/yyyy">mm/dd/aaaa</option>
          </Select>
          <Select label="Separador decimal" name="mapDecimal" defaultValue="comma">
            <option value="comma">Vírgula (1.234,56)</option>
            <option value="dot">Ponto (1,234.56)</option>
          </Select>
          <Select label="O gasto aparece como" name="mapExpenseSign" defaultValue="negative">
            <option value="negative">Valor negativo</option>
            <option value="positive">Valor positivo</option>
          </Select>
        </fieldset>
      )}

      {state.error && (
        <p role="alert" className="text-[13px] text-mark">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Lendo o arquivo…' : mapping ? 'Ver prévia' : 'Ler arquivo'}
      </Button>
    </form>
  );
}
