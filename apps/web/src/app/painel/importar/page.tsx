import { AccountList } from '@finlens/contracts';
import { ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { apiFetch } from '@/lib/api';
import { ImportFlow } from './import-flow';

export default async function ImportarPage() {
  const accounts = (await apiFetch('/v1/accounts', AccountList)).filter((a) => !a.archived);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Importar extrato</h1>
        <p className="mt-1 text-ink-soft">
          Você vê a prévia antes de gravar. O que já foi importado ou lançado à mão não duplica.
        </p>
      </div>
      {accounts.length === 0 ? (
        <Panel className="max-w-xl px-6 py-8">
          <p className="font-medium">Cadastre uma conta antes de importar</p>
          <p className="mt-1 text-ink-soft">O extrato precisa de uma conta ou cartão de destino.</p>
          <ButtonLink className="mt-4" href="/painel/contas/nova">
            Cadastrar conta
          </ButtonLink>
        </Panel>
      ) : (
        <ImportFlow accounts={accounts} />
      )}
    </div>
  );
}
