// ── Legacy router shim ─────────────────────────────────────────────────────
// TanStack Start's entry point is now app/router.tsx + app/client.tsx.
// This shim re-exports createRouter so any stray imports keep compiling.
// The `Register` declaration lives in app/router.tsx; do NOT duplicate it here.
export { createRouter, makeQueryClient } from "../app/router"
