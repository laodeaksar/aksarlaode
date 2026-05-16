import { createRootRoute, Outlet, redirect } from "@tanstack/react-router"
import { Suspense }  from "react"
import { Sidebar }  from "@/components/layout/sidebar"
import { Topbar }   from "@/components/layout/topbar"
import { getSession } from "@/lib/auth"
import { hasAnyAdminRole } from "@/lib/rbac"
import { ErrorBoundary } from "@/components/error-boundary"

// FIX ADM-05: Accept ADMIN, OWNER, and FINANCE roles — not just ADMIN.
// All three roles are permitted to access the admin panel; individual
// pages enforce finer-grained permissions via `can()` from rbac.ts.
export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/login") return

    const session = await getSession()
    if (!session || !hasAnyAdminRole(session.role)) {
      throw redirect({ to: "/login" })
    }
  },

  component: () => (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        {/* FIX ADM-07: ErrorBoundary wraps the entire page outlet so a crash
            in one route renders an error card instead of a blank white page.
            FIX ADM-06: Suspense catches React.lazy boundaries from
            lazily-loaded route components (products, orders, customers). */}
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
            <Suspense fallback={
              <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                Loading…
              </div>
            }>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  ),
})
