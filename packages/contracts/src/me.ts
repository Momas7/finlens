import { z } from 'zod';

export const MeResponse = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  workspace: z.object({ id: z.uuid(), name: z.string() }),
});
export type MeResponse = z.infer<typeof MeResponse>;
