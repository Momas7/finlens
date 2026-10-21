import { createHash } from 'node:crypto';
import type {
  ImportCommitResult,
  ImportPreview,
  ImportPreviewRequest,
  ImportRowStatus,
} from '@finlens/contracts';
import {
  type Db,
  type ImportBatchRow,
  importBatches,
  type TenantContext,
  type Tx,
  transactions,
  withTenant,
} from '@finlens/db';
import { normalize, parseImport, statementMonth } from '@finlens/domain';
import { and, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { ApiError, notFound } from '../../http/errors';
import { findAccount } from '../accounts/repository';
import { activeCategories } from '../classification/evidence';
import { categorize } from '../transactions/categorize';
import { autoLinkFor } from '../transfers/queries';

const MAX_ROWS = 5000;
const PREVIEW_TTL_HOURS = 24;
const ALREADY_IMPORTED = 'Este arquivo já foi importado.';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** Chave de deduplicação: FITID quando houver, senão conta + data + valor + descrição + ordem. */
function withKeys(
  accountId: string,
  rows: {
    postedDate: string;
    description: string;
    amountCents: bigint;
    externalId: string | null;
  }[],
): ImportBatchRow[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = r.externalId
      ? `fitid:${r.externalId}`
      : [
          r.postedDate,
          r.amountCents.toString(),
          normalize(r.description).normalized || r.description,
        ].join('|');
    const ordinal = seen.get(base) ?? 0;
    seen.set(base, ordinal + 1);
    return {
      postedDate: r.postedDate,
      description: r.description,
      amountCents: r.amountCents.toString(),
      externalId: r.externalId,
      key: sha256(`${accountId}|${base}|${ordinal}`),
    };
  });
}

/** Marca cada linha: nova, já importada (mesma chave) ou já existente (lançamento manual igual). */
async function statusFor(
  tx: Tx,
  accountId: string,
  rows: ImportBatchRow[],
): Promise<ImportRowStatus[]> {
  if (rows.length === 0) return [];
  const keys = rows.map((r) => r.key);
  const known = new Set<string>();
  for (let i = 0; i < keys.length; i += 1000) {
    const found = await tx
      .select({ key: transactions.importKey })
      .from(transactions)
      .where(inArray(transactions.importKey, keys.slice(i, i + 1000)));
    for (const f of found) if (f.key) known.add(f.key);
  }
  const dates = rows.map((r) => r.postedDate).sort();
  const manual = await tx
    .select({ date: transactions.postedDate, cents: transactions.amountCents })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        isNull(transactions.importKey),
        gte(transactions.postedDate, dates[0] ?? ''),
        lte(transactions.postedDate, dates[dates.length - 1] ?? ''),
      ),
    );
  const available = new Map<string, number>();
  for (const m of manual) {
    const k = `${m.date}|${m.cents}`;
    available.set(k, (available.get(k) ?? 0) + 1);
  }
  return rows.map((r) => {
    if (known.has(r.key)) return 'imported';
    const k = `${r.postedDate}|${r.amountCents}`;
    const left = available.get(k) ?? 0;
    if (left > 0) {
      available.set(k, left - 1);
      return 'existing';
    }
    return 'new';
  });
}

async function activeAccount(tx: Tx, accountId: string) {
  const account = await findAccount(tx, accountId, true);
  if (!account) throw notFound('Conta');
  if (account.archivedAt) {
    throw new ApiError(409, 'conflict', 'Esta conta está arquivada e não aceita lançamentos.', {
      accountId: 'Conta arquivada.',
    });
  }
  return account;
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}

export async function previewImport(
  db: Db,
  ctx: TenantContext & { workspaceId: string },
  input: ImportPreviewRequest,
): Promise<ImportPreview> {
  const parsed = parseImport(input.content, input.mapping);
  if (parsed.kind === 'error') {
    throw new ApiError(400, 'validation', parsed.message, { content: parsed.message });
  }
  if (parsed.kind === 'needs_mapping') {
    return { needsMapping: { headers: parsed.headers, sample: parsed.sample } };
  }
  if (parsed.rows.length > MAX_ROWS) {
    const message = `O arquivo tem mais de ${MAX_ROWS} lançamentos. Divida por período.`;
    throw new ApiError(400, 'validation', message, { content: message });
  }
  const fileSha = sha256(input.content);

  return withTenant(db, ctx, async (tx) => {
    const account = await activeAccount(tx, input.accountId);
    const [done] = await tx
      .select({ id: importBatches.id })
      .from(importBatches)
      .where(and(eq(importBatches.fileSha256, fileSha), eq(importBatches.status, 'committed')));
    if (done) throw new ApiError(409, 'conflict', ALREADY_IMPORTED, { content: ALREADY_IMPORTED });

    await tx
      .delete(importBatches)
      .where(
        and(
          eq(importBatches.status, 'preview'),
          sql`(${importBatches.createdAt} < now() - make_interval(hours => ${PREVIEW_TTL_HOURS}) or ${importBatches.fileSha256} = ${fileSha})`,
        ),
      );

    const rows = withKeys(account.id, parsed.rows);
    const statuses = await statusFor(tx, account.id, rows);
    const [batch] = await tx
      .insert(importBatches)
      .values({
        workspaceId: ctx.workspaceId,
        accountId: account.id,
        fileSha256: fileSha,
        filename: input.filename,
        format: parsed.format,
        status: 'preview',
        rows,
      })
      .returning({ id: importBatches.id });
    if (!batch) throw new Error('Falha ao criar o lote de importação');

    const count = (s: ImportRowStatus) => statuses.filter((x) => x === s).length;
    return {
      batchId: batch.id,
      format: parsed.format,
      summary: {
        total: rows.length,
        new: count('new'),
        imported: count('imported'),
        existing: count('existing'),
        payments:
          account.type === 'credit_card'
            ? rows.filter((r) => BigInt(r.amountCents) > 0n).length
            : 0,
        ignored: parsed.ignored,
      },
      rows: rows.map((r, i) => ({
        postedDate: r.postedDate,
        description: r.description,
        amountCents: r.amountCents,
        status: statuses[i] ?? 'new',
      })),
    };
  });
}

export async function commitImport(
  db: Db,
  ctx: TenantContext & { workspaceId: string },
  batchId: string,
): Promise<ImportCommitResult> {
  try {
    return await withTenant(db, ctx, async (tx) => {
      // O UPDATE condicional serializa commits concorrentes: o segundo espera e não acha 'preview'.
      const [batch] = await tx
        .update(importBatches)
        .set({ status: 'committed', committedAt: new Date() })
        .where(and(eq(importBatches.id, batchId), eq(importBatches.status, 'preview')))
        .returning();
      if (!batch) {
        const [exists] = await tx
          .select({ id: importBatches.id })
          .from(importBatches)
          .where(eq(importBatches.id, batchId));
        if (!exists) throw notFound('Importação');
        throw new ApiError(409, 'conflict', ALREADY_IMPORTED);
      }
      const account = await activeAccount(tx, batch.accountId);
      const statuses = await statusFor(tx, account.id, batch.rows);
      const active = await activeCategories(tx);

      const fresh = batch.rows
        .map((row, i) => ({ row, status: statuses[i] }))
        .filter((x) => x.status === 'new')
        .sort((a, b) => a.row.postedDate.localeCompare(b.row.postedDate));
      for (const { row } of fresh) {
        const amountCents = BigInt(row.amountCents);
        const { fields } = await categorize(
          tx,
          'auto',
          { description: row.description, amountCents, accountId: account.id },
          active,
        );
        const [created] = await tx
          .insert(transactions)
          .values({
            workspaceId: ctx.workspaceId,
            accountId: account.id,
            postedDate: row.postedDate,
            statementMonth:
              account.type === 'credit_card'
                ? statementMonth(row.postedDate, account.closingDay ?? 31)
                : null,
            amountCents,
            description: row.description,
            source: 'import',
            importKey: row.key,
            ...fields,
          })
          .returning({ id: transactions.id });
        if (created) await autoLinkFor(tx, ctx.workspaceId, created.id);
      }
      return {
        imported: fresh.length,
        skippedImported: statuses.filter((s) => s === 'imported').length,
        skippedExisting: statuses.filter((s) => s === 'existing').length,
      };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, 'conflict', ALREADY_IMPORTED);
    throw err;
  }
}
