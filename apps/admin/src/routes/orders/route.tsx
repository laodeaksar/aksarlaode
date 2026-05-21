import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";

import { listOrdersFn } from "@/server/orders";
import { ordersSearchSchema } from "@/lib/search-schemas";
import { can } from "@/lib";

export const Route = createFileRoute("/orders")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session || !can(session.role, "orders:read")) {
      throw redirect({ to: "/dashboard" });
    }
  },

  validateSearch: zodValidator(ordersSearchSchema),

  loaderDeps: ({ search }) => ({
    page: search.page,
    status: search.status,
  }),

  loader: ({ deps, context }) => {
    const { queryClient } = context;
    return queryClient.ensureQueryData({
      queryKey: ["orders", { page: deps.page ?? 1, status: deps.status }],
      queryFn: () =>
        listOrdersFn({
          data: {
            page: deps.page ?? 1,
            ...(deps.status ? { status: deps.status } : {}),
          },
        }),
    });
  },

  head: () => ({
    meta: [{ title: "Orders — Admin" }],
  }),

  component: () => <Outlet />,
});
