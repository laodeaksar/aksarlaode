import { createFileRoute, Outlet } from "@tanstack/react-router";

import { getDashboardStatsFn } from "@/server/dashboard";

export const Route = createFileRoute("/dashboard")({
  loader: () => getDashboardStatsFn({}),
  component: () => <Outlet />,
});
