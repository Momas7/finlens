import { DeleteAccount } from '@finlens/contracts';
import { account, type Db, user } from '@finlens/db';
import { verify } from '@node-rs/argon2';
import { and, eq } from 'drizzle-orm';
import { ApiError } from '../../http/errors';

const WRONG_PASSWORD = new ApiError(400, 'validation', 'Verifique os campos.', {
  password: 'Senha incorreta.',
});

/**
 * Exclui a conta de forma permanente. Apagar `user` leva, em cascata, sessões, contas do auth,
 * o workspace pessoal e todas as tabelas financeiras (FKs com `on delete cascade`).
 */
export async function deleteAccount(db: Db, userId: string, body: unknown): Promise<void> {
  const input = DeleteAccount.parse(body);
  if (input.confirm !== 'EXCLUIR') {
    throw new ApiError(400, 'validation', 'Verifique os campos.', {
      confirm: 'Digite EXCLUIR para confirmar.',
    });
  }
  const [credential] = await db
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));
  if (!credential?.password) throw WRONG_PASSWORD;
  const ok = await verify(credential.password, input.password).catch(() => false);
  if (!ok) throw WRONG_PASSWORD;
  await db.delete(user).where(eq(user.id, userId));
}
