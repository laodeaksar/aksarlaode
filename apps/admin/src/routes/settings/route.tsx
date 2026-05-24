import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getSettingsFn } from "@/server/settings";
import { can, queryKeys } from "@/lib";

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
      queryKey: queryKeys.storeSettings,
      queryFn: () => getSettingsFn({}),
    });
  },

  component: () => <Outlet />,
});
