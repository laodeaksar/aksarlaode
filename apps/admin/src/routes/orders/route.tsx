import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { listOrdersFn } from "@/server/orders";
import { can } from "@/lib";

export const Route = createFileRoute("/orders")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session || !can(session.role, "orders:read")) {
      throw redirect({ to: "/dashboard" });
    }
  },

  validateSearch: (search: Record<string, unknown>) => ({
    page: Math.max(1, Number(search.page) || 1),
    status: typeof search.status === "string" ? search.status : "",
  }),

  loaderDeps: ({ search }) => ({
    page: search.page,
    status: search.status,
  }),

  loader: ({ deps }) =>
    listOrdersFn({
      data: {
        page: deps.page,
        ...(deps.status ? { status: deps.status } : {}),
      },
    }),

  head: () => ({
    meta: [{ title: "Orders — Admin" }],
  }),

  component: () => <Outlet />,
});
