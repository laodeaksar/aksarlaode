import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getOrderFn } from "@/server/orders";
import { can, queryKeys } from "@/lib";

export const Route = createFileRoute("/orders/$orderId")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session) throw redirect({ to: "/login" });
    if (!can(session.role, "orders:read")) throw redirect({ to: "/forbidden" });
  },

  loader: ({ params, context }) => {
    const { queryClient } = context;
    return queryClient.ensureQueryData({
      queryKey: queryKeys.orders.detail(params.orderId),
      queryFn: () => getOrderFn({ data: { id: params.orderId } }),
      staleTime: 5 * 60 * 1_000,
    });
  },

  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Order #${loaderData.orderId} — Admin`
          : "Order Detail — Admin",
      },
    ],
  }),

  component: () => <Outlet />,
});
