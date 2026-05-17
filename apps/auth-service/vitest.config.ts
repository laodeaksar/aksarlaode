import { resolve } from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      // Resolve @/* path alias (mirrors tsconfig paths)
      "@": resolve(__dirname, "./src"),

      // Redirect env imports to a static mock — no parseEnv() / process.exit() during tests
      "@repo/env/auth": resolve(
        __dirname,
        "./src/__tests__/__mocks__/env-auth.ts"
      ),
      "@repo/env/database": resolve(
        __dirname,
        "./src/__tests__/__mocks__/env-database.ts"
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/index.ts"],
    },
  },
})
