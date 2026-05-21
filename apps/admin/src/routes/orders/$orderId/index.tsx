import { createFileRoute } from "@tanstack/react-router";

import { OrderDetail } from "@/components/orders";

export const Route = createFileRoute("/orders/$orderId/")({
  component: function OrderDetailPage() {
    const { orderId } = Route.useParams();
    return <OrderDetail orderId={orderId} />;
  },
});
