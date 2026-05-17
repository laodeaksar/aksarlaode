import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

// ── TanStack Start Vite config ─────────────────────────────────────────────
// `tanstackStart` replaces `@vitejs/plugin-react` for SSR-aware bundling.
// It instruments `createServerFn()` calls so they are split into
// server-only and client-stub bundles automatically.

export default defineConfig({
  plugins: [
    nitro(),
    // @ts-ignore
    tailwindcss(),
    viteReact(),
    // @ts-ignore
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart()
  ],
  server: {
    host: "0.0.0.0",
    port: 4322,
    allowedHosts: true,
  },
  optimizeDeps: {
    include: ["effect"],
  },
})
