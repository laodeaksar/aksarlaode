import { createFileRoute } from "@tanstack/react-router";

import { getOrderFn } from "@/server/orders";
import { OrderDetail } from "@/components/orders/order-detail";

export const Route = createFileRoute("/orders/$orderId")({
  loader: ({ params, context }) => {
    const { queryClient } = context;
    return queryClient.ensureQueryData({
      queryKey: ["order", params.orderId],
      queryFn: () => getOrderFn({ data: { id: params.orderId } }),
    });
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { orderId } = Route.useParams();
  return <OrderDetail orderId={orderId} />;
}
