import type { Account } from '@finlens/contracts';

export const accountLabel = (a: Account) => (a.archived ? `${a.name} (arquivada)` : a.name);
