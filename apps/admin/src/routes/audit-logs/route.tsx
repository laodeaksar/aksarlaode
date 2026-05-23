import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { valibotValidator } from "@tanstack/valibot-adapter";

import { listAuditLogsFn } from "@/server/audit-logs";
import { auditLogsSearchSchema } from "@/lib/search-schemas";
import { can, queryKeys } from "@/lib";

export const Route = createFileRoute("/audit-logs")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session) throw redirect({ to: "/login" });
    if (!can(session.role, "audit:read")) throw redirect({ to: "/forbidden" });
  },

  // All filter state lives in the URL so every combination is bookmarkable,
  // shareable, and survives browser back/forward navigation.
  validateSearch: valibotValidator(auditLogsSearchSchema),

  loaderDeps: ({ search }) => ({
    page: search.page,
    startDate: search.startDate,
    endDate: search.endDate,
    action: search.action,
    actorRole: search.actorRole,
  }),

  loader: ({ deps, context }) => {
    const { queryClient } = context;
    return queryClient.ensureQueryData({
      queryKey: queryKeys.auditLogs.list({
        page: deps.page ?? 1,
        startDate: deps.startDate,
        endDate: deps.endDate,
        action: deps.action,
        actorRole: deps.actorRole,
      }),
      queryFn: () =>
        listAuditLogsFn({
          data: {
            page: deps.page ?? 1,
            ...(deps.startDate ? { startDate: deps.startDate } : {}),
            ...(deps.endDate ? { endDate: deps.endDate } : {}),
            ...(deps.action ? { action: deps.action } : {}),
            ...(deps.actorRole ? { actorRole: deps.actorRole } : {}),
          },
        }),
    });
  },

  head: () => ({
    meta: [{ title: "Audit Logs — Admin" }],
  }),

  component: () => <Outlet />,
});
