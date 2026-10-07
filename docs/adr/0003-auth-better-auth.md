# ADR 0003 — Autenticação com Better Auth

- Status: aceito
- Data: 2026-10-06

## Contexto

A API é separada do frontend e no futuro atenderá um app mobile. A solução de autenticação precisa funcionar fora do Next.js, guardar dados no nosso Postgres e oferecer 2FA.

## Decisão

- Better Auth montado na API Fastify em `/api/auth/*`, com adapter Drizzle e as tabelas `user`, `session`, `account` e `verification`.
- Login por e-mail e senha. Senha mínima de 10 caracteres.
- Hash com argon2id (`@node-rs/argon2`, parâmetros OWASP: 19 MiB, 2 iterações, paralelismo 1) no lugar do hash padrão da biblioteca.
- Sessão em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- O Next.js faz proxy de `/api/auth/*` e `/v1/*` para a API, então o navegador vê uma única origem.
- Rate limit pelo `@fastify/rate-limit`: 300 req/min por IP globalmente e 10 req/min em `sign-in/email` e `sign-up/email`. O rate limit interno do Better Auth fica desligado. O IP do cliente vem do `X-Forwarded-For` apenas quando a conexão chega de um proxy listado em `TRUSTED_PROXIES` (padrão: `127.0.0.1,::1`, o Next.js na mesma máquina); o limite de login e cadastro é configurável por `AUTH_RATE_LIMIT_PER_MINUTE`.
- Telemetria do Better Auth desligada.
- Workspace pessoal criado no hook `user.create.after` e, como fallback, sob demanda em `requireAuth`. Uma falha no hook não impede o cadastro.

## Consequências

- O app mobile futuro pode usar o mesmo endpoint, com cookies ou com o plugin de bearer token do Better Auth.
- 2FA (plugin `twoFactor`) fica para a F6 e exigirá uma migration nova.
- A versão do CLI do Better Auth estava atrás da biblioteca, por isso o schema Drizzle das tabelas de auth foi escrito à mão. Ao atualizar o Better Auth, revisar o schema core.
