# Imagem única do perfil demo: serve API, web, migrações e seed (cada serviço muda o comando).
# Uso local apenas — veja "Experimente em 1 comando" no README.
FROM docker.io/library/node:24-slim

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    TURBO_TELEMETRY_DISABLED=1 \
    CI=1

RUN corepack enable

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node . .
RUN pnpm install --frozen-lockfile

# Os rewrites do Next (/api/auth e /v1 → API) são resolvidos no build.
ARG API_URL=http://api:3333
ENV API_URL=$API_URL
RUN pnpm --filter @finlens/web build

ENV NODE_ENV=production
EXPOSE 3000 3333
CMD ["pnpm", "--filter", "@finlens/web", "start"]
