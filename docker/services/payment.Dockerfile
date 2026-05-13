FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# ── Dependency installation ─────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/env/package.json               packages/env/
COPY packages/common/package.json            packages/common/
COPY packages/database/package.json          packages/database/
COPY apps/payment-service/package.json       apps/payment-service/
RUN pnpm install --frozen-lockfile

# ── Build ───────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY packages/ packages/
COPY apps/payment-service/ apps/payment-service/
RUN pnpm --filter payment-service build
RUN pnpm deploy --filter=payment-service --prod /standalone

# ── Production runner ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl

COPY --from=builder /standalone/node_modules ./node_modules
COPY --from=builder /app/apps/payment-service/dist ./dist

EXPOSE 3004
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=30s \
  CMD curl -f http://localhost:3004/health || exit 1

CMD ["node", "dist/index.js"]
