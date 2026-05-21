import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";

import { listCustomersFn } from "@/server/customers";
import { customersSearchSchema } from "@/lib/search-schemas";
import { can } from "@/lib";

export const Route = createFileRoute("/customers")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session || !can(session.role, "customers:read")) {
      throw redirect({ to: "/dashboard" });
    }
  },

  validateSearch: zodValidator(customersSearchSchema),

  loaderDeps: ({ search }) => ({
    page: search.page,
    search: search.search,
  }),

  loader: ({ deps, context }) => {
    const { queryClient } = context;
    return queryClient.ensureQueryData({
      queryKey: ["customers", { page: deps.page ?? 1, search: deps.search }],
      queryFn: () =>
        listCustomersFn({
          data: {
            page: deps.page ?? 1,
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
