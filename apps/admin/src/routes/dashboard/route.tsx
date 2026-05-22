import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getDashboardStatsFn } from "@/server/dashboard";
import { can } from "@/lib";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session || !can(session.role, "dashboard:read")) {
      throw redirect({ to: "/login" });
    }
  },

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
