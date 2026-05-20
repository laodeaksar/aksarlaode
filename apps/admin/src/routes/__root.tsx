import * as React from "react";

import {
  createRootRouteWithContext,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import type { ParsedLocation } from "@tanstack/react-router";

import { RootDocument } from "@/components/layout/root-document";
import { DefaultCatchBoundary, NotFound } from "@/components/shared";
import {
  hasAnyAdminRole,
  silentRefresh,
  type RouterContext,
  type Session,
} from "@/lib";
import { getSessionFn } from "@/server/auth";

import appCss from "@repo/ui/globals.css?url";

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
