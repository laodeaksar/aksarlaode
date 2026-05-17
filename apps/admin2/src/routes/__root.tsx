/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  redirect,
  useRouterState,
} from '@tanstack/react-router'
import { Suspense } from 'react'
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
    if (location.pathname.startsWith("/login")) return

    const session = await getSession()
    if (!session || !hasAnyAdminRole(session.role)) {
      throw redirect({ to: "/login" as any })
    }

    return { session }
  },

  errorComponent: ({ error }) => (
    <RootDocument>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center max-w-md w-full">
          <p className="text-base font-semibold text-red-700 mb-2">
            Something went wrong
          </p>
          <p className="mb-4 text-sm text-red-600">
            {error instanceof Error
              ? error.message
              : "An unexpected error occurred."}
          </p>
          <a
            href="/dashboard"
            className="inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </RootDocument>
  ),

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

  const routeCtx = Route.useRouteContext() as { session?: Session }
  const session = routeCtx.session ?? null

  if (pathname.startsWith("/login")) {
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
              <main className="flex-1 overflow-y-auto p-6">
                <ErrorBoundary>
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                        Loading…
                      </div>
                    }
                  >
                    {children}
                  </Suspense>
                </ErrorBoundary>
              </main>
            </div>
          </div>
          {import.meta.env.DEV && (
            <>
              <TanStackRouterDevtools position="bottom-right" />
              <ReactQueryDevtools buttonPosition="bottom-left" />
            </>
          )}
          <Scripts />
        </body>
      </html>
    </SessionContext.Provider>
  )
}
