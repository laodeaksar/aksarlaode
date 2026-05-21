import * as React from "react";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { Toaster } from "sonner";

import type { Session } from "@/lib/auth";
import { SessionContext } from "@/lib/session-context";

import { AppLayout } from "./app-layout";
import { LoginLayout } from "./login-layout";

type RootDocumentProps = {
  children: React.ReactNode;
  session: Session | null;
};

export function RootDocument({ children, session }: RootDocumentProps) {
  const pathname = useRouterState({
    select: (s: { location: { pathname: string } }) => s.location.pathname,
  });

  if (pathname.startsWith("/login")) {
    return (
      <html>
        <head>
          <HeadContent />
        </head>
        <body>
          <LoginLayout>{children}</LoginLayout>
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
          <AppLayout>{children}</AppLayout>

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
