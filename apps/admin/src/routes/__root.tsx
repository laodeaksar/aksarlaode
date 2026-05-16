import { createRootRoute, Outlet, redirect } from "@tanstack/react-router"
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
            in one route renders an error card instead of a blank white page. */}
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  ),
})
