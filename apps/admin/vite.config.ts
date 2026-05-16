import { defineConfig }   from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

// ── TanStack Start Vite config ─────────────────────────────────────────────
// `tanstackStart` replaces `@vitejs/plugin-react` for SSR-aware bundling.
// It instruments `createServerFn()` calls so they are split into
// server-only and client-stub bundles automatically.

export default defineConfig({
  plugins: [
    nitro(),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    viteReact(),
    tanstackStart({
      // Route generation config
      tsr: {
        routesDirectory:    "./src/routes",
        generatedRouteTree: "./src/routeTree.gen.ts",
        quoteStyle:         "double",
        semicolons:         false,
      },
      // SSR entry point
      server: {
        entry: "./app/ssr.tsx",
      },
      // Client hydration entry point
      client: {
        entry: "./app/client.tsx",
      },
    }),
  ],
  server: {
    host:         "0.0.0.0",
    port:         4322,
    allowedHosts: true,
  },
  optimizeDeps: {
    include: ["effect"],
  },
})
