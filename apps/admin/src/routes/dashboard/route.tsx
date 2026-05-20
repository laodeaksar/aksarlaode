import { createFileRoute, Outlet } from "@tanstack/react-router";

import { getDashboardStatsFn } from "@/server/dashboard";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — Admin" }],
  }),

  loader: ({ context }) => {
    const { queryClient } = context;
    return queryClient.ensureQueryData({
      queryKey: ["dashboard-stats"],
      queryFn: () => getDashboardStatsFn({}),
    });
  },
  component: () => <Outlet />,
});
