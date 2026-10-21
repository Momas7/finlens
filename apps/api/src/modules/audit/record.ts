import type { AuditEvent } from '@finlens/contracts';
import { auditLogs, type Db, withTenant } from '@finlens/db';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';

const RETENTION_DAYS = 180;

export type AuditInput = {
  userId: string;
  event: AuditEvent;
  ip?: string | null;
  userAgent?: string | null;
  /** Só dados mínimos (formato, contagem). Nunca valores, descrições nem segredos. */
  meta?: Record<string, string | number>;
};

/** Grava um evento de atividade. Best-effort: falhar aqui nunca derruba a ação da pessoa. */
export async function recordAudit(
  db: Db,
  log: FastifyBaseLogger,
  input: AuditInput,
): Promise<void> {
  try {
    await withTenant(db, { userId: input.userId }, async (tx) => {
      await tx.insert(auditLogs).values({
        userId: input.userId,
        event: input.event,
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
        meta: input.meta ?? null,
      });
      await tx
        .delete(auditLogs)
        .where(
          and(
            eq(auditLogs.userId, input.userId),
            lt(auditLogs.createdAt, sql`now() - make_interval(days => ${RETENTION_DAYS})`),
          ),
        );
    });
  } catch (err) {
    log.warn({ err, event: input.event }, 'falha ao gravar o registro de atividade');
  }
}
