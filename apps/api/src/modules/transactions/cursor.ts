const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cursor opaco da paginação por chave (posted_date desc, id desc). */
export function encodeCursor(postedDate: string, id: string): string {
  return Buffer.from(`${postedDate}|${id}`).toString('base64url');
}

export function decodeCursor(cursor: string): { postedDate: string; id: string } | null {
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) return null;
  const [postedDate, id, extra] = Buffer.from(cursor, 'base64url').toString().split('|');
  if (extra !== undefined || !postedDate || !id) return null;
  if (!DATE.test(postedDate) || !UUID.test(id)) return null;
  // Date.parse aceita "2026-02-31"; a ida e volta pela data recusa dias inexistentes.
  const parsed = new Date(`${postedDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== postedDate)
    return null;
  return { postedDate, id };
}
