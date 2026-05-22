import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { valibotValidator } from "@tanstack/valibot-adapter";

import { queueSearchSchema } from "@/lib/search-schemas";
import { can } from "@/lib";
import { getQueueStatsFn, getFailedJobsFn } from "@/server/queue";

export const Route = createFileRoute("/queue")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session) throw redirect({ to: "/login" });
    if (!can(session.role, "queue:read")) throw redirect({ to: "/forbidden" });
  },

  validateSearch: valibotValidator(queueSearchSchema),

  head: () => ({
    meta: [{ title: "Email Queue — Admin" }],
  }),

  loader: async ({ context }) => {
    const { queryClient } = context;
    await Promise.all([
      queryClient.ensureQueryData({
        queryKey: ["queue-stats"],
        queryFn: () => getQueueStatsFn({}),
      }),
      queryClient.ensureQueryData({
        queryKey: ["queue-failed-jobs"],
        queryFn: () => getFailedJobsFn({}),
      }),
    ]);
  },

  component: () => <Outlet />,
});
