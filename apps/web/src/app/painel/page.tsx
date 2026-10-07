import { LogoMark } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { getMe } from '@/lib/me';

export default async function PainelPage() {
  const me = await getMe();
  return (
    <div className="space-y-8">
      <div className="min-w-0">
        <h1
          className="truncate text-[32px] font-semibold tracking-tight"
          style={{ fontStretch: '85%' }}
        >
          Olá, {me.user.name}
        </h1>
      </div>
      <Panel as="section" aria-labelledby="empty-title" className="px-6 py-12 text-center sm:px-12">
        <div className="mx-auto flex max-w-md flex-col items-center">
          <span className="text-ink-soft">
            <LogoMark size={32} />
          </span>
          <h2 id="empty-title" className="mt-4 text-[18px] font-semibold">
            Importe seu primeiro extrato
          </h2>
          <p className="mt-2 text-ink-soft">
            O Finlens classifica as transações e mostra para onde vai seu dinheiro.
          </p>
          <Button className="mt-6" disabled aria-describedby="import-soon">
            Importar extrato
          </Button>
          <p id="import-soon" className="mt-2 text-[13px] text-ink-soft">
            Disponível na próxima fase
          </p>
        </div>
      </Panel>
    </div>
  );
}
