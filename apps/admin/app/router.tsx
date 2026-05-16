import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { QueryClient }                           from "@tanstack/react-query"
import { routeTree }                             from "../src/routeTree.gen"

// ── QueryClient factory (shared config) ───────────────────────────────────
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime:            60 * 1_000,
        retry:                1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

// ── Router factory ─────────────────────────────────────────────────────────
// Called once on the server (SSR) and once on the client (hydration).
// Each invocation gets a fresh QueryClient so there is no cross-request sharing.
// The QueryClient is available via `router.options.context.queryClient`.

export function createRouter() {
  const queryClient = makeQueryClient()

  return createTanStackRouter({
    routeTree,
    context:                 { queryClient },
    defaultPreload:          "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration:       true,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
