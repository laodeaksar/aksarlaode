import { defineConfig }   from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import react              from "@vitejs/plugin-react"
import path               from "path"

// ── TanStack Start Vite config ─────────────────────────────────────────────
// `tanstackStart` replaces `@vitejs/plugin-react` for SSR-aware bundling.
// It instruments `createServerFn()` calls so they are split into
// server-only and client-stub bundles automatically.

export default defineConfig({
  plugins: [
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
    // Keep react plugin for JSX transform in files not covered by tanstackStart
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host:         "0.0.0.0",
    port:         4322,
    allowedHosts: true,
  },
  optimizeDeps: {
    include: ["effect"],
  },
})
