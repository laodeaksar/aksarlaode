import { createRootRoute, Outlet, redirect } from "@tanstack/react-router"
import { Sidebar }  from "@/components/layout/sidebar"
import { Topbar }   from "@/components/layout/topbar"
import { getSession } from "@/lib/auth"

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/login") return

    const session = await getSession()
    if (!session || session.role !== "ADMIN") {
      throw redirect({ to: "/login" })
    }
  },

  component: () => (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  ),
})
