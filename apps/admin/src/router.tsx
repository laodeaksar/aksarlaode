import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { toast } from "sonner";

import { silentRefresh } from "@/lib/api";
import { NotFound, DefaultCatchBoundary } from "@/components/shared";

import { routeTree } from "./routeTree.gen";

// ── 401 detection ──────────────────────────────────────────────────────────
// TanStack Start serialises Effect errors (ApiError, UnauthorizedError) as
// plain objects with `_tag` and `status` fields.  We also catch plain objects
// with just a `status: 401` for any non-Effect server functions.

function is401(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  return e["status"] === 401 || e["_tag"] === "UnauthorizedError";
}

// ── Refresh state ──────────────────────────────────────────────────────────
// One refresh attempt per cooldown window.  If a second 401 arrives within
// COOLDOWN_MS it means the session is truly dead → redirect to login.
// `silentRefresh` already serialises concurrent calls via a singleton promise,
// so multiple queries failing at the same instant only trigger one network
// request to /auth/refresh.

const REFRESH_COOLDOWN_MS = 10_000;
let lastRefreshAttempt = 0;

// ── Session-expired redirect ───────────────────────────────────────────────
// Shows a warning toast so the user understands why the redirect is happening,
// waits briefly for the toast to be readable, then navigates to /login.
// `id` deduplicates: if multiple 401s fire simultaneously only one toast shows.

async function redirectToLogin(): Promise<void> {
  if (typeof window === "undefined") return;
  toast.warning("Sesi Anda telah berakhir. Mengarahkan ke halaman login...", {
    id: "session-expired",
    duration: 4_000,
  });
  await new Promise<void>((resolve) => setTimeout(resolve, 1_500));
  window.location.href = "/login";
}

async function handle401(queryClient: QueryClient): Promise<void> {
  const now = Date.now();

  if (now - lastRefreshAttempt < REFRESH_COOLDOWN_MS) {
    // Already refreshed (or tried) very recently but still getting 401 —
    // the session is truly expired.  Notify and redirect.
    await redirectToLogin();
    return;
  }

  lastRefreshAttempt = now;
  const refreshed = await silentRefresh();

  if (refreshed) {
    // New access token is in the cookie.  Invalidate every query so React
    // Query re-fetches with the fresh token on next render cycle.
    await queryClient.invalidateQueries();
  } else {
    await redirectToLogin();
  }
}

// ── QueryClient factory (shared config) ───────────────────────────────────

export function makeQueryClient() {
  // Declare first so the cache callbacks can close over it.
  let queryClient: QueryClient;

  const queryCache = new QueryCache({
    onError: (error: Error) => {
      if (!is401(error)) return;
      // Fire-and-forget — React Query does not await onError.
      void handle401(queryClient);
    },
  });

  const mutationCache = new MutationCache({
    onError: (error: Error) => {
      if (!is401(error)) return;
      void handle401(queryClient);
    },
  });

  queryClient = new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        staleTime: 60 * 1_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

  return queryClient;
}

export function getRouter() {
  const queryClient = makeQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
  });
  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
