import { z } from 'zod';
import { Uuid } from './money';

export const AuditEvent = z.enum([
  'sign_in',
  'two_factor_enabled',
  'two_factor_disabled',
  'backup_codes_regenerated',
  'data_exported',
  'import_committed',
]);
export type AuditEvent = z.infer<typeof AuditEvent>;

export const ActivityItem = z.object({
  id: Uuid,
  event: AuditEvent,
  ip: z.string().nullable(),
  createdAt: z.string(),
  meta: z.record(z.string(), z.union([z.string(), z.number()])).nullable(),
});
export type ActivityItem = z.infer<typeof ActivityItem>;

export const ActivityList = z.array(ActivityItem);
export type ActivityList = z.infer<typeof ActivityList>;
