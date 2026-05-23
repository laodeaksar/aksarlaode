import {
  createRootRouteWithContext,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import type { ParsedLocation } from "@tanstack/react-router";

import appCss from "@repo/ui/globals.css?url";

import { getSessionFn } from "@/server/auth";
import { RootDocument } from "@/components/layout/root-document";
import { DefaultCatchBoundary, NotFound } from "@/components/shared";
import {
  hasAnyAdminRole,
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
      {
        // frame-ancestors and X-Frame-Options are HTTP-header-only directives;
        // they are already set via vite.config.ts server.headers (dev) and
        // should be set by the deployment reverse proxy in production.
        httpEquiv: "Content-Security-Policy",
        content: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https: blob:",
          "connect-src 'self' *",
          "font-src 'self' data:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      },
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
      const cached = queryClient.getQueryData<Session>(["session"]);
      if (cached && hasAnyAdminRole(cached.role)) {
        throw redirect({ to: "/dashboard" });
      }
      return;
    }

    let session = await queryClient.fetchQuery({
      queryKey: ["session"],
      queryFn: getSessionFn,
      staleTime: 2 * 60 * 1_000,
    });

    if (!session) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        queryClient.removeQueries({ queryKey: ["session"] });
        session = await queryClient.fetchQuery({
          queryKey: ["session"],
          queryFn: getSessionFn,
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
      <RootDocument session={null}>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },

  notFoundComponent: () => <NotFound />,
  shellComponent: RootComponent,
});

function RootComponent() {
  const routeCtx = Route.useRouteContext();
  const session = routeCtx.session ?? null;

  return (
    <RootDocument session={session}>
      <Outlet />
    </RootDocument>
  );
}
