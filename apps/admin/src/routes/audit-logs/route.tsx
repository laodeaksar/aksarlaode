import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { listAuditLogsFn } from "@/server/audit-logs";
import { can, type Session } from "@/lib";

export const Route = createFileRoute("/audit-logs")({
  beforeLoad: ({ context }) => {
    const { session } = context as { session?: Session };
    if (!session || !can(session.role, "audit:read")) {
      throw redirect({ to: "/dashboard" });
    }
  },

  // All filter state lives in the URL so every combination is bookmarkable,
  // shareable, and survives browser back/forward navigation.
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search.page) > 1 ? Math.floor(Number(search.page)) : undefined,
    startDate:
      typeof search.startDate === "string" && search.startDate
        ? search.startDate
        : undefined,
    endDate:
      typeof search.endDate === "string" && search.endDate
        ? search.endDate
        : undefined,
    action:
      typeof search.action === "string" && search.action
        ? search.action
        : undefined,
    actorRole:
      typeof search.actorRole === "string" && search.actorRole
        ? search.actorRole
        : undefined,
  }),

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
