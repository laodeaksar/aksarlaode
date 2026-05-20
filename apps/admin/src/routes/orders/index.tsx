import { lazy } from "react";

import { createFileRoute } from "@tanstack/react-router";

const OrdersPage = lazy(() => import("./-page"));

export const Route = createFileRoute("/orders/")({
  component: OrdersPage,
});
