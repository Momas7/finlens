import { z } from 'zod';
import { Uuid } from './money';

export const LlmStatus = z.object({ enabled: z.boolean() });
export type LlmStatus = z.infer<typeof LlmStatus>;

export const LlmSuggestRequest = z.object({ transactionId: Uuid });
export type LlmSuggestRequest = z.infer<typeof LlmSuggestRequest>;

export type LlmSuggestion =
  | { categoryId: string; label: string; confidence: number; explanation: string }
  | { categoryId: null };
