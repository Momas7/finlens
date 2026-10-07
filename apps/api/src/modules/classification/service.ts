import type { Tx } from '@finlens/db';
import { type Classification, classify, matchMerchant, normalize } from '@finlens/domain';
import { type ActiveCategory, activeCategories, loadEvidence } from './evidence';

export type ClassifyInput = {
  description: string;
  amountCents: bigint;
  accountId: string | null;
  excludeTransactionId?: string;
};

/** Classifica com a evidência atual do workspace. Não grava nada. */
export async function classifyFor(
  tx: Tx,
  input: ClassifyInput,
  active?: Map<string, ActiveCategory>,
): Promise<Classification & { categories: Map<string, ActiveCategory> }> {
  const categories = active ?? (await activeCategories(tx));
  const normalized = normalize(input.description).normalized;
  const merchantKey = matchMerchant(normalized)?.key ?? null;
  const evidence = await loadEvidence(
    tx,
    { normalized, merchantKey, excludeTransactionId: input.excludeTransactionId },
    categories,
  );
  return { ...classify(input, evidence), categories };
}
