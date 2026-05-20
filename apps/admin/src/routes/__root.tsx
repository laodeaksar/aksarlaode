import * as React from "react";

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

import { DefaultCatchBoundary } from '@/components/default-catch-boundary'
import { NotFound } from "@/components/not-found";
import { ErrorBoundary } from "@/components";
import {
  getSession,
  hasAnyAdminRole,
  SessionContext,
  silentRefresh,
  type RouterContext,
  type Session,
} from "@/lib";

export const Route = createRootRouteWithContext<RouterContext>()({
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

  beforeLoad: async ({
    location,
    context,
  }: {
    location: ParsedLocation;
    context: RouterContext;
  }) => {
    const { queryClient } = context;

    if (location.pathname.startsWith("/login")) {
      // Redirect already-authenticated users away from the login page.
      const cached = queryClient.getQueryData<Session>(["session"]);
      if (cached && hasAnyAdminRole(cached.role)) {
        throw redirect({ to: "/dashboard" });
      }
      return;
    }

    // staleTime: 2 min — short enough to reflect role changes promptly,
    // long enough to avoid a /auth/me call on every client-side navigation.
    let session = await queryClient.fetchQuery({
      queryKey: ["session"],
      queryFn: getSession,
      staleTime: 2 * 60 * 1_000,
    });

    if (!session) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        queryClient.removeQueries({ queryKey: ["session"] });
        session = await queryClient.fetchQuery({
          queryKey: ["session"],
          queryFn: getSession,
          staleTime: 0,
        });
      }
    }

    if (!session || !hasAnyAdminRole(session.role)) {
      throw redirect({ to: "/login" });
    }

    return { session };
  },

  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    )
  },

  notFoundComponent: () => <NotFound />,
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

  const routeCtx = Route.useRouteContext();
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
