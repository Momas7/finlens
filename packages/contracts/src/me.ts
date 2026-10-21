import { z } from 'zod';

export const MeResponse = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    twoFactorEnabled: z.boolean().default(false),
  }),
  workspace: z.object({ id: z.uuid(), name: z.string() }),
});
export type MeResponse = z.infer<typeof MeResponse>;

export const DeleteAccount = z.object({
  password: z.string().min(1, 'Informe sua senha.').max(200),
  confirm: z.string().max(20),
});
export type DeleteAccount = z.infer<typeof DeleteAccount>;
