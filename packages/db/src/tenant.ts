import { sql } from 'drizzle-orm';
import type { Db, Tx } from './client';

export type TenantContext = { userId: string; workspaceId?: string };

/**
 * Executa `fn` numa transação com o contexto do tenant definido para as políticas RLS.
 * `set_config(..., true)` vale só para a transação, então o contexto não vaza para
 * outras queries que reutilizem a mesma conexão do pool.
 */
export function withTenant<T>(db: Db, ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.user_id', ${ctx.userId}, true), set_config('app.workspace_id', ${ctx.workspaceId ?? ''}, true)`,
    );
    return fn(tx);
  });
}
