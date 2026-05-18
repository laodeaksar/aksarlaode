import { resolve } from "path";

import { defineConfig } from "vitest/config";

/**
 * Separate Vitest config for integration / smoke tests.
 *
 * Differences from the default vitest.config.ts:
 *
 *  • @repo/env/auth     → integration env mock (real DATABASE_URL + fresh
 *                          Ed25519 keypairs, no process.exit).
 *  • @repo/env/database → integration env mock (real DATABASE_URL).
 *  • @/lib/redis        → in-memory mock (eval always allows, setex/get
 *                          backed by a Map).
 *  • @/lib/password     → SHA-256 shim (Argon2 native bindings are not
 *                          available under the Node Vitest runner).
 *
 *  • globalSetup runs Drizzle migrations so the schema is current before
 *    any test file executes.
 *
 * Run with:
 *   pnpm --filter auth-service test:integration
 */

const MOCKS = resolve(__dirname, "src/__tests__/integration/__mocks__");

export default defineConfig({
  resolve: {
    alias: {
      // ── Specific overrides must come before the catch-all "@" alias ──────
      "@/lib/redis": resolve(MOCKS, "redis.ts"),
      "@/lib/password": resolve(MOCKS, "password.ts"),

      // ── Env packages — use real DATABASE_URL, fresh JWT keys ─────────────
      "@repo/env/auth": resolve(MOCKS, "env-auth.ts"),
      "@repo/env/database": resolve(MOCKS, "env-database.ts"),

      // ── Path alias (mirrors tsconfig paths) ──────────────────────────────
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/integration/**/*.smoke.test.ts"],
    globalSetup: ["src/__tests__/integration/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run integration tests sequentially — they share a real database
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
