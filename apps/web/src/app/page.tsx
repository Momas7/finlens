import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { ButtonLink } from '@/components/ui/button';
import { Scale } from '@/components/ui/scale';
import { ClassifierDemo } from './(landing)/classifier-demo';

const REPO_URL = 'https://github.com/Momas7/finlens';

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
        <Logo />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <ButtonLink href="/login" variant="ghost">
            Entrar
          </ButtonLink>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:pt-20">
          <div className="max-w-xl">
            <h1
              className="text-[32px] leading-[1.05] font-semibold tracking-tight text-balance sm:text-[48px]"
              style={{ fontStretch: '82%' }}
            >
              <span className="block">Importe o extrato. </span>
              <span className="block">O Finlens mede para onde vai seu dinheiro.</span>
            </h1>
            <p className="mt-5 max-w-[60ch] text-[18px] text-ink-soft">
              Ele reconhece cada compra, separa por categoria e aponta onde o gasto saiu do padrão,
              com o valor e o impacto de cada mudança.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup" size="lg">
                Criar conta
              </ButtonLink>
              <ButtonLink href="/login" size="lg" variant="secondary">
                Entrar
              </ButtonLink>
            </div>
          </div>
          <ClassifierDemo />
        </section>

        <section aria-labelledby="how-title" className="border-t border-scale bg-raised">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="how-title" className="text-[24px] font-semibold tracking-tight">
              O que acontece depois da importação
            </h2>
            <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
              <article>
                <h3 className="text-[18px] font-semibold">Classifica sozinho</h3>
                <p className="mt-2 text-ink-soft">
                  De 300 transações, 274 entram na categoria certa sem você abrir nenhuma. Você
                  revisa só as que geram dúvida.
                </p>
                <Scale
                  className="mt-5"
                  value={274}
                  max={300}
                  label="Transações classificadas automaticamente"
                  valueText="274 de 300"
                />
                <p className="mt-2 text-[13px] text-ink-soft tabular-nums">274 de 300</p>
              </article>
              <article>
                <h3 className="text-[18px] font-semibold">Aprende com você</h3>
                <p className="mt-2 text-ink-soft">
                  Mudou uma compra da Amazon de Compras para Casa? As próximas parecidas, em valor e
                  descrição, seguem a sua correção.
                </p>
                <div className="mt-5 rounded-[6px] border border-scale bg-page px-4 py-3">
                  <p className="text-[13px] text-ink-soft">AMAZON BR, R$ 349,90</p>
                  <p className="mt-0.5">
                    <del className="text-ink-soft">Compras</del> <span aria-hidden="true">›</span>{' '}
                    <ins className="font-medium no-underline">Casa</ins>
                  </p>
                </div>
              </article>
              <article>
                <h3 className="text-[18px] font-semibold">Mostra o problema e o impacto</h3>
                <p className="mt-2 text-ink-soft">
                  Delivery e Uber somam R$&nbsp;1.000 por mês. Reduzir 20% nessas categorias libera
                  R$&nbsp;200 por mês para a sua meta.
                </p>
                <p className="figure mt-5 text-[32px] text-gain">+R$&nbsp;200</p>
                <p className="mt-1 text-[13px] text-ink-soft">liberados por mês</p>
              </article>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-[13px] text-ink-soft sm:px-6">
        <p>Open source e self-hosted. Licença MIT.</p>
        <a href={REPO_URL} className="font-medium text-ink underline underline-offset-4">
          Código no GitHub
        </a>
      </footer>
    </div>
  );
}
