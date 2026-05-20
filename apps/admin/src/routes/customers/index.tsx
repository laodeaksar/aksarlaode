import { lazy } from "react";

import { createFileRoute } from "@tanstack/react-router";

const CustomersPage = lazy(() => import("./-page"));

export const Route = createFileRoute("/customers/")({
  component: CustomersPage,
});
