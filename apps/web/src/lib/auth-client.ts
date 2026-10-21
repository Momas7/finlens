import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// Sem baseURL: as rotas /api/auth/* são servidas pela mesma origem (rewrite para a API).
export const authClient = createAuthClient({ plugins: [twoFactorClient()] });
