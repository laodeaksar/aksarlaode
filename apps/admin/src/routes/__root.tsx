import {
  createRootRouteWithContext,
  Outlet,
  redirect,
  useRouterState,
  HeadContent,
  Scripts,
  ScrollRestoration,
} from "@tanstack/react-router"
import { QueryClient }     from "@tanstack/react-query"
import { Suspense }        from "react"
import { Sidebar }         from "@/components/layout/sidebar"
import { Topbar }          from "@/components/layout/topbar"
import { getSession }      from "@/lib/auth"
import { hasAnyAdminRole } from "@/lib/rbac"
import { ErrorBoundary }   from "@/components/error-boundary"

// ── Root route — SSR document shell ───────────────────────────────────────
// With TanStack Start the root component renders the full HTML document.
// <HeadContent /> injects <title> and other head tags from route.head().
// <Scripts />     injects the client hydration bundle.
// <ScrollRestoration /> restores scroll position on client navigation.

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Admin — MyEcommerce" },
    ],
  }),

  // Auth guard: runs on SSR and every client-side navigation.
  // FIX ADM-05: Accept ADMIN, OWNER, and FINANCE roles.
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

  component: RootDocument,
})

// ── Full HTML document (required for SSR hydration) ────────────────────────
function RootDocument() {
  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body>
        <AdminShell />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

// ── Admin shell — conditional layout for authenticated vs login pages ─────
function AdminShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  if (pathname === "/login") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        {/* FIX ADM-07: ErrorBoundary catches crashes in any child route.
            FIX ADM-06: Suspense handles React.lazy code-split boundaries. */}
        <main className="flex-1 overflow-y-auto p-6">
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
        </main>
      </div>
    </div>
  )
}
