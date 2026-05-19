import * as React from "react";

import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  redirect,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import type { ParsedLocation } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";

import { Toaster } from "sonner";

import appCss from "@repo/ui/globals.css?url";

import { ErrorBoundary } from "@/components";
import {
  getSession,
  hasAnyAdminRole,
  SessionContext,
  silentRefresh,
  type Session,
} from "@/lib";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
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

  beforeLoad: async ({ location }: { location: ParsedLocation }) => {
    if (location.pathname.startsWith("/login")) return;

    let session = await getSession();

    if (!session) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        session = await getSession();
      }
    }

    if (!session || !hasAnyAdminRole(session.role)) {
      throw redirect({ to: "/login" });
    }

    return { session };
  },

  errorComponent: ({ error }: { error: unknown }) => (
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
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({
    select: (s: { location: { pathname: string } }) => s.location.pathname,
  });

  const routeCtx = Route.useRouteContext() as { session?: Session };
  const session = routeCtx.session ?? null;

  if (pathname.startsWith("/login")) {
    return (
      <html>
        <head>
          <HeadContent />
        </head>
        <body>
          <div className="min-h-screen bg-muted/40">
            {children}
            <Toaster position="top-center" richColors />
          </div>
          <Scripts />
        </body>
      </html>
    );
  }

  return (
    <SessionContext.Provider value={{ session, loading: false }}>
      <html>
        <head>
          <HeadContent />
        </head>
        <body>
          <SidebarProvider
            style={
              {
                "--sidebar-width": "calc(var(--spacing) * 72)",
                "--header-height": "calc(var(--spacing) * 12)",
              } as React.CSSProperties
            }
          >
            <AppSidebar variant="inset" />
            <SidebarInset>
              <SiteHeader />
              <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                  <ErrorBoundary>
                    <React.Suspense
                      fallback={
                        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                          Loading…
                        </div>
                      }
                    >
                      {children}
                    </React.Suspense>
                  </ErrorBoundary>
                </div>
              </div>
            </SidebarInset>
          </SidebarProvider>

          {import.meta.env.DEV && (
            <>
              <TanStackRouterDevtools position="bottom-right" />
              <ReactQueryDevtools buttonPosition="bottom-left" />
            </>
          )}

          <Toaster position="top-center" richColors />
          <Scripts />
        </body>
      </html>
    </SessionContext.Provider>
  );
}
