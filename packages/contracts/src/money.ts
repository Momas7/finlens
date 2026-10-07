import { z } from 'zod';

/** Centavos como string de inteiro com sinal: JSON não transporta bigint sem perda. */
export const Cents = z.string().regex(/^-?\d{1,15}$/, 'Valor em centavos inválido.');
export const NonZeroCents = Cents.refine((v) => !/^-?0+$/.test(v), 'O valor não pode ser zero.');
export const IsoDate = z.iso.date('Data inválida.');
export const Uuid = z.uuid();
