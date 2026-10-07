import type { CategoryKind, CategoryNode } from '@finlens/contracts';

export type CategoryOption = { id: string; label: string; kind: CategoryKind };

/** Achata a árvore em opções "Raiz › Filha"; raízes sem filhas viram opção própria. */
export function categoryOptions(
  tree: CategoryNode[],
): { group: string; options: CategoryOption[] }[] {
  return tree.map((root) => ({
    group: root.name,
    options:
      root.children.length === 0
        ? [{ id: root.id, label: root.name, kind: root.kind }]
        : root.children.map((c) => ({ id: c.id, label: `${root.name} › ${c.name}`, kind: c.kind })),
  }));
}

export function categoryLabels(tree: CategoryNode[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const root of tree) {
    labels.set(root.id, root.name);
    for (const child of root.children) labels.set(child.id, `${root.name} › ${child.name}`);
  }
  return labels;
}
