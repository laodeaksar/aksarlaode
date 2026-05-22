import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";

import { listAuditLogsFn } from "@/server/audit-logs";
import { auditLogsSearchSchema } from "@/lib/search-schemas";
import { can } from "@/lib";

export const Route = createFileRoute("/audit-logs")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session || !can(session.role, "audit:read")) {
      throw redirect({ to: "/dashboard" });
    }
  },

  // All filter state lives in the URL so every combination is bookmarkable,
  // shareable, and survives browser back/forward navigation.
  validateSearch: zodValidator(auditLogsSearchSchema),

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
      queryKey: [
        "audit-logs",
        {
          page: deps.page ?? 1,
          startDate: deps.startDate,
          endDate: deps.endDate,
          action: deps.action,
          actorRole: deps.actorRole,
        },
      ],
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
