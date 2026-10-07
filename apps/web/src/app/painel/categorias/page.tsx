import { CategoryTree, ClassificationRuleList } from '@finlens/contracts';
import { Panel } from '@/components/ui/panel';
import { apiFetch } from '@/lib/api';
import { ArchiveCategory, DeleteRule, NewCategoryForm, RenameCategory } from './category-forms';

export default async function CategoriasPage() {
  const [tree, rules] = await Promise.all([
    apiFetch('/v1/categories', CategoryTree),
    apiFetch('/v1/classification-rules', ClassificationRuleList),
  ]);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Categorias</h1>
        <p className="mt-1 text-ink-soft">
          Organize como seus lançamentos são agrupados. Arquivar não apaga o histórico.
        </p>
      </div>

      <Panel as="section" aria-labelledby="new-category" className="p-5">
        <h2 id="new-category" className="mb-4 font-semibold">
          Nova categoria
        </h2>
        <NewCategoryForm roots={tree} />
      </Panel>

      <Panel className="overflow-hidden">
        <ul aria-label="Suas categorias">
          {tree.map((root) => (
            <li key={root.id} className="border-b border-scale last:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-2 px-5 py-3">
                <span className="pt-1 font-medium">{root.name}</span>
                <div className="flex items-start gap-1">
                  <RenameCategory category={root} />
                  <ArchiveCategory category={root} />
                </div>
              </div>
              {root.children.length > 0 && (
                <ul aria-label={`Subcategorias de ${root.name}`} className="pb-2">
                  {root.children.map((child) => (
                    <li
                      key={child.id}
                      className="flex flex-wrap items-start justify-between gap-2 py-1.5 pr-5 pl-10"
                    >
                      <span className="pt-1 text-ink-soft">{child.name}</span>
                      <div className="flex items-start gap-1">
                        <RenameCategory category={child} />
                        <ArchiveCategory category={child} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel as="section" aria-labelledby="rules-title" className="p-5">
        <h2 id="rules-title" className="font-semibold">
          Suas regras
        </h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Criadas com &quot;Sempre classificar assim&quot; na edição de um lançamento. Valem antes
          de qualquer sugestão automática.
        </p>
        {rules.length === 0 ? (
          <p className="mt-4 text-ink-soft">Nenhuma regra ainda.</p>
        ) : (
          <ul className="mt-4 divide-y divide-scale">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <span className="font-medium">{r.pattern}</span>
                  <span className="text-ink-soft"> → {r.categoryLabel}</span>
                </span>
                <DeleteRule id={r.id} pattern={r.pattern} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
