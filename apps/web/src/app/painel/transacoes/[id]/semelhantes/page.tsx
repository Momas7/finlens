import { CategoryTree, SimilarList } from '@finlens/contracts';
import { notFound, redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { categoryLabels } from '@/lib/categories';
import { parseId } from '@/lib/ids';
import { backFromSimilar } from '../../actions';
import { SimilarForm } from './similar-form';

export default async function SemelhantesPage({
  params,
  searchParams,
}: PageProps<'/painel/transacoes/[id]/semelhantes'>) {
  const { id: rawId } = await params;
  const query = await searchParams;
  const from = query.de === 'revisao' ? 'revisao' : undefined;
  const back = await backFromSimilar(from);
  const id = parseId(rawId);
  const categoryId = typeof query.categoria === 'string' ? parseId(query.categoria) : null;
  if (!id || !categoryId) notFound();
  const [items, tree] = await Promise.all([
    apiFetch(`/v1/transactions/${id}/similar?categoryId=${categoryId}`, SimilarList).catch(
      () => null,
    ),
    apiFetch('/v1/categories', CategoryTree),
  ]);
  if (!items) notFound();
  if (items.length === 0) redirect(back);
  const label = categoryLabels(tree).get(categoryId) ?? 'esta categoria';
  const n = items.length;
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">
          Aplicar {label} a {n} {n === 1 ? 'lançamento parecido' : 'lançamentos parecidos'}?
        </h1>
        <p className="mt-1 text-ink-soft">
          Ainda não confirmados. Os marcados passam para {label} e ensinam o Finlens.
        </p>
      </div>
      <SimilarForm items={items} categoryId={categoryId} from={from} back={back} />
    </div>
  );
}
