import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getCustomerFn } from "@/server/customers";
import { can } from "@/lib";

export const Route = createFileRoute("/customers/$userId")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session || !can(session.role, "customers:read")) {
      throw redirect({ to: "/dashboard" });
    }
  },

  loader: ({ params, context }) => {
    const { queryClient } = context;
    return queryClient.ensureQueryData({
      queryKey: ["customer", params.userId],
      queryFn: () => getCustomerFn({ data: { id: params.userId } }),
      staleTime: 5 * 60 * 1_000,
    });
  },

  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData ? `${loaderData.name} — Admin` : "Customer — Admin",
      },
    ],
  }),

  component: () => <Outlet />,
});
