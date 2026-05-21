import { createFileRoute } from "@tanstack/react-router";

import { CustomerDetail } from "@/components/customers";

export const Route = createFileRoute("/customers/$userId/")({
  component: function CustomerDetailPage() {
    const { userId } = Route.useParams();
    return <CustomerDetail userId={userId} />;
  },
});
