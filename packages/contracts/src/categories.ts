import { z } from 'zod';
import { Uuid } from './money';

export const CategoryKind = z.enum(['expense', 'income', 'movement']);
export type CategoryKind = z.infer<typeof CategoryKind>;

export type CategoryNode = {
  id: string;
  name: string;
  kind: CategoryKind;
  systemKey: string | null;
  children: CategoryNode[];
};
export const CategoryNode: z.ZodType<CategoryNode> = z.lazy(() =>
  z.object({
    id: Uuid,
    name: z.string(),
    kind: CategoryKind,
    systemKey: z.string().nullable(),
    children: z.array(CategoryNode),
  }),
);
export const CategoryTree = z.array(CategoryNode);

const CategoryName = z.string().trim().min(1, 'Informe um nome.').max(40, 'Use até 40 caracteres.');

export const CategoryCreate = z.object({ name: CategoryName, parentId: Uuid.optional() });
export type CategoryCreate = z.infer<typeof CategoryCreate>;

export const CategoryUpdate = z.object({ name: CategoryName }).strict();
export type CategoryUpdate = z.infer<typeof CategoryUpdate>;
