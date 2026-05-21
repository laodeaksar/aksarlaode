import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { listCustomersFn } from "@/server/customers";
import { can } from "@/lib";

export const Route = createFileRoute("/customers")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session || !can(session.role, "customers:read")) {
      throw redirect({ to: "/dashboard" });
    }
  },

  validateSearch: (search: Record<string, unknown>) => ({
    page: Math.max(1, Number(search.page) || 1),
    search:
      typeof search.search === "string" && search.search
        ? search.search
        : undefined,
  }),

  loaderDeps: ({ search }) => ({
    page: search.page,
    search: search.search,
  }),

  loader: ({ deps, context }) => {
    const { queryClient } = context;
    return queryClient.ensureQueryData({
      queryKey: ["customers", { page: deps.page, search: deps.search }],
      queryFn: () =>
        listCustomersFn({
          data: {
            page: deps.page,
            ...(deps.search ? { search: deps.search } : {}),
          },
        }),
    });
  },

  head: () => ({
    meta: [{ title: "Customers — Admin" }],
  }),

  component: () => <Outlet />,
});
