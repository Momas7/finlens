# Finlens

Analista financeiro pessoal open source e self-hosted. Você importa extratos, o Finlens classifica quase tudo sozinho, pede confirmação apenas do que tem dúvida, aprende com as suas correções e transforma os dados em insights acionáveis: problema, evidência, impacto em R$ e sugestão.

Não é um CRUD de despesas. O foco é um pipeline de classificação híbrido e mensurável (regras, histórico do usuário, similaridade e LLM apenas como último recurso) e um motor de insights determinístico que nunca inventa números.

> **Status:** contas, lançamentos e classificação automática prontos (F0, F1a e F2a). Veja o [roadmap](docs/architecture.md#11-roadmap).

**Classificador:** em um dataset sintético de 301 lançamentos, 85% são categorizados sozinhos com 99,6% de precisão — [relatório completo](docs/classifier-eval.md), regenerado e verificado no CI.

## Stack

- **Web:** Next.js (App Router), React, Tailwind CSS
- **API:** Fastify, Zod, Better Auth
- **Banco:** PostgreSQL 17 com Row-Level Security, Drizzle ORM
- **Monorepo:** pnpm + Turborepo, Biome, Vitest, Playwright
- **CI:** GitHub Actions (lint, typecheck, testes unitários, de integração e E2E, gitleaks)

## Arquitetura

```
apps/web (Next.js) ──HTTP──► apps/api (Fastify) ──► PostgreSQL (RLS)

packages/domain     regras de negócio puras, sem I/O
packages/db         schema Drizzle, migrations, políticas RLS
packages/contracts  schemas Zod compartilhados entre web e api
```

O Next.js encaminha `/api/auth/*` e `/v1/*` para a API, então o navegador fala com uma única origem e o cookie de sessão nunca é exposto a outro domínio.

Detalhes e decisões:

- [Arquitetura e escopo do MVP](docs/architecture.md)
- [ADR 0001 — Monólito modular em monorepo](docs/adr/0001-monorepo-modular.md)
- [ADR 0002 — Isolamento de tenant com RLS](docs/adr/0002-rls-multi-tenant.md)
- [ADR 0003 — Autenticação com Better Auth](docs/adr/0003-auth-better-auth.md)

## Rodando localmente

Pré-requisitos: Node 24, Docker ou Podman com Compose.

```bash
corepack enable pnpm
pnpm install
cp .env.example .env
# gere um secret e cole em BETTER_AUTH_SECRET no .env
openssl rand -base64 32
docker compose up -d db        # ou: podman compose up -d db
pnpm --filter @finlens/db db:migrate
pnpm dev
```

Web em http://localhost:3000, API em http://localhost:3333.

> As senhas dos roles do banco em `.env.example` e `infra/postgres/init/01-roles.sql` são apenas para desenvolvimento local. Nunca use esses valores em produção.

## Testes

```bash
pnpm lint
pnpm typecheck
pnpm test                 # unitários
pnpm test:integration     # precisa do Postgres do compose rodando
pnpm eval:classifier      # avalia o classificador e atualiza docs/classifier-eval.md
pnpm --filter @finlens/web test:e2e
```

Os testes de integração criam um database temporário por arquivo de teste e o apagam ao final.

## Segurança

- Cada tabela de tenant usa `ENABLE` e `FORCE ROW LEVEL SECURITY`. A API conecta com um role sem `BYPASSRLS`; uma query sem contexto de tenant retorna zero linhas.
- Senhas com argon2id. Cookies `HttpOnly` e `SameSite=Lax`, `Secure` em produção.
- Rate limit global e mais restrito em login e cadastro.
- Logs com redaction de cookies, headers de autorização e senhas.
- Nenhum dado financeiro real entra no repositório: fixtures são sintéticas e `fixtures/private/` está no `.gitignore`.

Encontrou uma vulnerabilidade? Abra uma issue sem detalhes sensíveis pedindo um canal privado de contato.

## Licença

[MIT](LICENSE)
