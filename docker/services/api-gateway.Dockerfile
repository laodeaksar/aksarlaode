FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# ── Dependency installation ─────────────────────────────────────────────────
# Copy only package manifests first — Docker layer-caches this until deps change.
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/env/package.json               packages/env/
COPY apps/api-gateway/package.json           apps/api-gateway/
RUN pnpm install --frozen-lockfile

# ── Build ───────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY packages/ packages/
COPY apps/api-gateway/ apps/api-gateway/
RUN pnpm --filter api-gateway build
# Create a self-contained deployment with only production dependencies
RUN pnpm deploy --filter=api-gateway --prod /standalone

# ── Production runner ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl

COPY --from=builder /standalone/node_modules ./node_modules
COPY --from=builder /app/apps/api-gateway/dist ./dist

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=30s \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
