import { getMe } from '@/lib/me';

export default async function DashboardPage() {
  const me = await getMe();
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Olá, {me.user.name}</h1>
      <p className="text-muted-foreground">
        Seu painel financeiro aparece aqui depois da primeira importação.
      </p>
    </section>
  );
}
