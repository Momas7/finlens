'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiSend, UnauthorizedError } from '@/lib/api';

/** Dispensa um insight; ele não volta a aparecer. */
export async function dismissInsight(id: string): Promise<void> {
  if (!/^[0-9a-f]{16}$/.test(id)) return;
  try {
    await apiSend('POST', '/v1/insights/dismiss', { id });
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/auth/clear-session');
    throw err;
  }
  revalidatePath('/painel', 'layout');
}
