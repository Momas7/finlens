import type { ActivityItem } from '@finlens/contracts';

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function label(item: ActivityItem): string {
  switch (item.event) {
    case 'sign_in':
      return 'Entrou na conta';
    case 'two_factor_enabled':
      return 'Ativou o 2FA';
    case 'two_factor_disabled':
      return 'Desativou o 2FA';
    case 'backup_codes_regenerated':
      return 'Gerou novos códigos de reserva';
    case 'data_exported':
      return item.meta?.format === 'csv'
        ? 'Exportou os lançamentos (CSV)'
        : 'Exportou os dados (JSON)';
    case 'import_committed': {
      const n = Number(item.meta?.imported ?? 0);
      return `Importou ${n} ${n === 1 ? 'lançamento' : 'lançamentos'}`;
    }
  }
}

export function Activity({ items }: { items: ActivityItem[] }) {
  if (items.length === 0)
    return <p className="text-ink-soft">Nenhuma atividade registrada ainda.</p>;
  return (
    <table className="w-full text-left text-[14px]">
      <caption className="sr-only">Atividade recente da conta</caption>
      <thead className="text-[13px] text-ink-soft">
        <tr>
          <th scope="col" className="py-2 pr-3 font-medium">
            Quando
          </th>
          <th scope="col" className="py-2 pr-3 font-medium">
            O que foi
          </th>
          <th scope="col" className="py-2 font-medium">
            IP
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-scale">
        {items.map((i) => (
          <tr key={i.id}>
            <td className="py-2 pr-3 whitespace-nowrap">
              {dateTime.format(new Date(i.createdAt))}
            </td>
            <td className="py-2 pr-3">{label(i)}</td>
            <td className="figure py-2 break-all">{i.ip ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
