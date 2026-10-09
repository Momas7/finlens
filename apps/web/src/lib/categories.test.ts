import type { CategoryNode } from '@finlens/contracts';
import { describe, expect, it } from 'vitest';
import { filterCategoryOptions } from './categories';

const node = (id: string, name: string, children: CategoryNode[] = []) =>
  ({ id, name, kind: 'expense', children }) as unknown as CategoryNode;

describe('filterCategoryOptions', () => {
  it('raiz com filhas ganha opção própria para filtrar tudo dela', () => {
    const tree = [node('a', 'Alimentação', [node('m', 'Mercado')]), node('o', 'Outros')];
    expect(filterCategoryOptions(tree)).toEqual([
      {
        group: 'Alimentação',
        options: [
          { id: 'a', label: 'Alimentação (todas)', kind: 'expense' },
          { id: 'm', label: 'Alimentação › Mercado', kind: 'expense' },
        ],
      },
      { group: 'Outros', options: [{ id: 'o', label: 'Outros', kind: 'expense' }] },
    ]);
  });
});
