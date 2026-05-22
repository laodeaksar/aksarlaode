import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { can } from "@/lib";
import { getSettingsFn } from "@/server/settings";

export const Route = createFileRoute("/settings")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session) throw redirect({ to: "/login" });
    if (!can(session.role, "settings:write"))
      throw redirect({ to: "/forbidden" });
  },

  head: () => ({
    meta: [{ title: "Settings — Admin" }],
  }),

  loader: ({ context }) => {
    const { queryClient } = context;
    return queryClient.ensureQueryData({
      queryKey: ["store-settings"],
      queryFn: () => getSettingsFn({}),
    });
  },

  component: () => <Outlet />,
});
