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
