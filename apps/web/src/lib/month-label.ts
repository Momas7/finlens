import type { Month } from '@finlens/domain';

const at = (month: Month) => new Date(`${month}-15T12:00:00Z`);
const longFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });
const shortFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });

/** "outubro" */
export const monthName = (month: Month) => longFmt.format(at(month));
/** "outubro de 2026" */
export const monthLabel = (month: Month) => `${monthName(month)} de ${month.slice(0, 4)}`;
/** "out" */
export const shortMonth = (month: Month) => shortFmt.format(at(month)).replace('.', '');
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
