import { createFileRoute, Outlet } from "@tanstack/react-router";

import { getDashboardStatsFn } from "@/server/dashboard";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — Admin" }],
  }),

  loader: () => getDashboardStatsFn({}),
  component: () => <Outlet />,
});
