import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { listCustomersFn } from "@/server/customers";
import { can, type Session } from "@/lib";

export const Route = createFileRoute("/customers")({
  beforeLoad: ({ context }) => {
    const { session } = context as { session?: Session };
    if (!session || !can(session.role, "customers:read")) {
      throw redirect({ to: "/dashboard" });
    }
  },

  validateSearch: (search: Record<string, unknown>) => ({
    page: Math.max(1, Number(search.page) || 1),
    search: typeof search.search === "string" ? search.search : "",
  }),

  loaderDeps: ({ search }) => ({
    page: search.page,
    search: search.search,
  }),

  loader: ({ deps }) =>
    listCustomersFn({
      data: {
        page: deps.page,
        ...(deps.search ? { search: deps.search } : {}),
      },
    }),

  component: () => <Outlet />,
});
