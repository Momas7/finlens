import { z } from 'zod';
import { Cents, IsoDate, TotalCents, Uuid } from './money';

export const AccountType = z.enum(['checking', 'savings', 'cash', 'credit_card']);
export type AccountType = z.infer<typeof AccountType>;

const Name = z.string().trim().min(1, 'Informe um nome.').max(60, 'Use até 60 caracteres.');
const Institution = z.string().trim().max(60, 'Use até 60 caracteres.').nullish();
const DAY_MESSAGE = 'Use um dia de 1 a 31.';
const Day = z
  .number({ error: DAY_MESSAGE })
  .int(DAY_MESSAGE)
  .min(1, DAY_MESSAGE)
  .max(31, DAY_MESSAGE);

export const AccountCreate = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('credit_card'),
    name: Name,
    institution: Institution,
    closingDay: Day,
    dueDay: Day,
  }),
  z.object({
    type: z.enum(['checking', 'savings', 'cash']),
    name: Name,
    institution: Institution,
    openingBalanceCents: Cents.default('0'),
    openingBalanceDate: IsoDate,
  }),
]);
export type AccountCreate = z.infer<typeof AccountCreate>;

/** Tipo é imutável: não aparece aqui, e `.strict()` recusa a chave. */
export const AccountUpdate = z
  .object({
    name: Name,
    institution: Institution,
    openingBalanceCents: Cents,
    openingBalanceDate: IsoDate,
    closingDay: Day,
    dueDay: Day,
  })
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'Informe ao menos um campo para alterar.');
export type AccountUpdate = z.infer<typeof AccountUpdate>;

export const Account = z.object({
  id: Uuid,
  name: z.string(),
  type: AccountType,
  institution: z.string().nullable(),
  openingBalanceCents: Cents,
  openingBalanceDate: IsoDate.nullable(),
  closingDay: z.number().nullable(),
  dueDay: z.number().nullable(),
  balanceCents: TotalCents.nullable(),
  openInvoiceCents: TotalCents.nullable(),
  currentStatementMonth: IsoDate.nullable(),
  archived: z.boolean(),
});
export type Account = z.infer<typeof Account>;
export const AccountList = z.array(Account);
