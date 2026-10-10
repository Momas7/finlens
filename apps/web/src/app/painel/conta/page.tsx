import { buttonClasses } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { getMe } from '@/lib/me';
import { DeleteAccountForm } from './delete-form';

export default async function ContaPage() {
  const me = await getMe();
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Sua conta</h1>
        <p className="mt-1 text-ink-soft">
          {me.user.name}, {me.user.email}
        </p>
      </div>

      <Panel as="section" aria-labelledby="export-title" className="space-y-4 p-5">
        <div>
          <h2 id="export-title" className="font-semibold">
            Exportar seus dados
          </h2>
          <p className="mt-1 text-[15px] text-ink-soft">
            O arquivo completo traz contas, categorias, lançamentos, regras, orçamentos e metas. A
            planilha traz só os lançamentos, pronta para abrir no Excel ou no Google Planilhas.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="/v1/me/export" download className={buttonClasses('secondary')}>
            Baixar tudo (JSON)
          </a>
          <a href="/v1/me/export.csv" download className={buttonClasses('secondary')}>
            Baixar lançamentos (CSV)
          </a>
        </div>
      </Panel>

      <Panel as="section" aria-labelledby="delete-title" className="space-y-4 border-mark/60 p-5">
        <div>
          <h2 id="delete-title" className="font-semibold">
            Excluir conta
          </h2>
          <p className="mt-1 text-[15px] text-ink-soft">
            Apaga sua conta e todos os seus dados de forma permanente: lançamentos, contas,
            categorias, regras, orçamentos e metas. Não dá para desfazer. Se quiser guardar uma
            cópia, exporte antes.
          </p>
        </div>
        <DeleteAccountForm />
      </Panel>
    </div>
  );
}
