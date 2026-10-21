import { sql } from 'drizzle-orm';
import type { Db } from './client';

/** Tabelas sem tenant (Better Auth): as únicas de `public` que podem ficar sem RLS. */
export const TABLES_WITHOUT_TENANT = [
  'user',
  'session',
  'account',
  'verification',
  'two_factor',
] as const;

/** Tabelas de `public` que não têm RLS ENABLE + FORCE, fora as listadas acima. */
export async function tablesWithoutForcedRls(db: Db): Promise<string[]> {
  const result = await db.execute<{ relname: string }>(sql`
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not (c.relrowsecurity and c.relforcerowsecurity)
    order by c.relname`);
  const allowed = new Set<string>(TABLES_WITHOUT_TENANT);
  return result.rows.map((r) => r.relname).filter((name) => !allowed.has(name));
}

/**
 * Impede a aplicação de subir conectada com um role que ignora RLS: nesse caso todas as
 * políticas ficariam inertes sem nenhum erro aparente.
 */
export async function assertAppRoleIsSafe(db: Db): Promise<void> {
  const result = await db.execute<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>(
    sql`select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
  );
  const role = result.rows[0];
  if (!role || role.rolsuper || role.rolbypassrls) {
    throw new Error(
      `DATABASE_URL usa o role "${role?.rolname ?? '?'}", que é superuser ou BYPASSRLS. Use o role da aplicação (finlens_app).`,
    );
  }
}
