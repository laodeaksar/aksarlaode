import { lazy } from "react";

import { createFileRoute } from "@tanstack/react-router";

const DashboardPage = lazy(() => import("./-page"));

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
});
