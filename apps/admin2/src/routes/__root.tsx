/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import * as React from 'react'
import type { QueryClient } from '@tanstack/react-query'

import appCss from "@repo/ui/globals.css?url"

import { getSession } from "@/lib/auth"
import type { Session } from "@/lib/auth"
import { hasAnyAdminRole } from "@/lib/rbac"
import { SessionContext } from "@/lib/session-context"
import { ErrorBoundary } from "@/components/error-boundary"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"


export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
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
 beforeLoad: async ({ location }) => {
      if (location.pathname === "/login") return

      const session = await getSession()
      if (!session || !hasAnyAdminRole(session.role)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw redirect({ to: "/login" as any })
      }

      return { session }
    },


 errorComponent: (props) => {
    return (
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
    )
  },
  // notFoundComponent: () => <NotFound />,
  shellComponent: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
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
    <html>
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
         <TanStackRouterDevtools position="bottom-right" />
        <ReactQueryDevtools buttonPosition="bottom-left" />
        <Scripts />
      </body>
    </html>
    </SessionContext.Provider>
  )
}
