import { InsightList } from '@finlens/contracts';
import { InsightCard } from '@/components/insight-card';
import { Panel } from '@/components/ui/panel';
import { apiFetch, UnauthorizedError } from '@/lib/api';

export default async function InsightsPage() {
  const data = await apiFetch('/v1/insights?limit=20', InsightList).catch((err) => {
    if (err instanceof UnauthorizedError) throw err;
    console.error(err);
    return null;
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">O que mudou</h1>
        <p className="mt-1 text-ink-soft">
          O que saiu do normal neste mês, do maior impacto para o menor.
        </p>
      </div>
      {data === null ? (
        <Panel className="p-5">
          <p className="text-ink-soft">Não foi possível carregar os insights agora.</p>
        </Panel>
      ) : data.items.length === 0 ? (
        <Panel className="p-5">
          <p className="text-ink-soft">
            Nada fora do comum por enquanto. Os insights aparecem conforme você lança.
          </p>
        </Panel>
      ) : (
        <ul aria-label="Insights" className="space-y-3">
          {data.items.map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </ul>
      )}
    </div>
  );
}
