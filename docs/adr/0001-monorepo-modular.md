# ADR 0001 — Monólito modular em monorepo

- Status: aceito
- Data: 2026-10-06

## Contexto

O MVP precisa de frontend web, API e worker. O roadmap prevê app mobile, integração com Open Finance (webhooks) e notificações. O projeto é mantido por uma pessoa e precisa ser simples de rodar localmente.

## Decisão

Usar um monorepo pnpm + Turborepo com:

- `apps/web` (Next.js), `apps/api` (Fastify) e, a partir da F1, `apps/worker`;
- `packages/domain` com regras de negócio puras, sem I/O;
- `packages/db` com schema, migrations e políticas de acesso;
- `packages/contracts` com schemas Zod compartilhados.

Todos os apps fazem deploy a partir do mesmo repositório e compartilham o mesmo banco. Não há microserviços.

## Consequências

- Lógica de negócio testável sem banco nem HTTP.
- Um cliente mobile futuro consome a mesma API e os mesmos contratos.
- Fronteiras entre módulos dependem de disciplina (imports apenas pelos `index.ts` dos pacotes), não de rede.
- Custo: mais configuração inicial (workspaces, turbo, tsconfig por pacote) do que um app Next.js único.
