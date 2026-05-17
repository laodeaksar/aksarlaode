/// <reference types="vite/client" />
import { Suspense, type ReactNode } from "react"
import { QueryClient } from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  redirect,
  Scripts,
  useRouterState,
} from "@tanstack/react-router"

import appCss from "@repo/ui/globals.css?url"

import { getSession } from "@/lib/auth"
import type { Session } from "@/lib/auth"
import { hasAnyAdminRole } from "@/lib/rbac"
import { SessionContext } from "@/lib/session-context"
import { ErrorBoundary } from "@/components/error-boundary"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"

// ── Root route — SSR document shell ───────────────────────────────────────
// With TanStack Start the root component renders the full HTML document.
// <HeadContent /> injects <title> and other head tags from route.head().
// <Scripts />     injects the client hydration bundle.
// <ScrollRestoration /> restores scroll position on client navigation.

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Admin — MyEcommerce" },
      ],
      links: [
        {
          rel: "stylesheet",
          href: appCss,
        },
      ],
    }),

    // Auth guard: runs on SSR and every client-side navigation.
    // Returns { session } which is merged into route context and consumed by
    // RootDocument via Route.useRouteContext() — zero client-side /auth/me call.
    beforeLoad: async ({ location }) => {
      if (location.pathname === "/login") return

      const session = await getSession()
      if (!session || !hasAnyAdminRole(session.role)) {
        // Route paths are validated by TanStack Router's generated type; cast to
        // bypass stale routeTree types before the next `tsr generate` run.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw redirect({ to: "/login" as any })
      }

      return { session }
    },

    errorComponent: () => (
      <RootDocument>
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                Loading…
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </RootDocument>
    ),

    shellComponent: RootComponent,
  }
)

// ── Full HTML document (required for SSR hydration) ────────────────────────
function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

// ── Admin shell — provides session context + conditional layout ───────────
// Session is read from route context (set by beforeLoad) — NOT re-fetched
// on the client. This eliminates the double /auth/me call and ensures that
// useSession() returns the correct value on the very first render.
function RootDocument({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // Route context is populated by beforeLoad's `return { session }`.
  // On the /login page beforeLoad returns early (no session), so we cast
  // safely and fall back to null.
  const routeCtx = Route.useRouteContext() as { session?: Session }
  const session = routeCtx.session ?? null

  if (pathname === "/login") {
    return <div className="min-h-screen bg-gray-50">{children}</div>
  }

  return (
    <SessionContext.Provider value={{ session, loading: false }}>
      <html lang="id">
        <head>
          <HeadContent />
        </head>
        <body>
          <div className="flex h-screen bg-gray-50">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <Topbar />
              <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
          </div>
          <Scripts />
        </body>
      </html>
    </SessionContext.Provider>
  )
}
