import { ButtonLink } from '@/components/ui/button';

// Substituída pela landing completa na próxima tarefa.
export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-[32px] font-semibold">Finlens</h1>
      <div className="mt-6 flex gap-3">
        <ButtonLink href="/signup">Criar conta</ButtonLink>
        <ButtonLink href="/login" variant="secondary">
          Entrar
        </ButtonLink>
      </div>
    </main>
  );
}
