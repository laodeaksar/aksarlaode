import { createFileRoute } from "@tanstack/react-router";

import { getCustomerFn } from "@/server/customers";
import { CustomerDetail } from "@/components/customers/customer-detail";

export const Route = createFileRoute("/customers/$userId")({
  loader: ({ params, context }) => {
    const { queryClient } = context;
    return queryClient.ensureQueryData({
      queryKey: ["customer", params.userId],
      queryFn: () => getCustomerFn({ data: { id: params.userId } }),
    });
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { userId } = Route.useParams();
  return <CustomerDetail userId={userId} />;
}
