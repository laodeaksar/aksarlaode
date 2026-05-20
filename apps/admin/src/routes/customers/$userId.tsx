import { createFileRoute } from "@tanstack/react-router";

import { getCustomerFn } from "@/server/customers";
import { CustomerDetail } from "@/components/customers";

export const Route = createFileRoute("/customers/$userId")({
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
        title: loaderData
          ? `${loaderData.name} — Admin`
          : "Customer — Admin",
      },
    ],
  }),

  component: RouteComponent,
});

function RouteComponent() {
  const { userId } = Route.useParams();
  return <CustomerDetail userId={userId} />;
}
