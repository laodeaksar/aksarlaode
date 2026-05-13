FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate
WORKDIR /app

# ── Dependencies ───────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/tsconfig/package.json   packages/tsconfig/
COPY packages/env/package.json        packages/env/
COPY packages/common/package.json     packages/common/
COPY packages/database/package.json   packages/database/
COPY apps/auth-service/package.json   apps/auth-service/
RUN pnpm install --frozen-lockfile

# ── Builder ────────────────────────────────────────────────
FROM deps AS builder
COPY packages/ packages/
COPY apps/auth-service/ apps/auth-service/
RUN pnpm --filter auth-service build

# ── Runner ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/auth-service/dist ./dist
COPY --from=builder /app/node_modules            ./node_modules

EXPOSE 3001
CMD ["node", "dist/index.js"]
