import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { listAuditLogsFn } from "@/server/audit-logs";
import { can } from "@/lib";

export const Route = createFileRoute("/audit-logs")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session || !can(session.role, "audit:read")) {
      throw redirect({ to: "/dashboard" });
    }
  },

  // Persist page in URL so back-button navigation and sharing preserve position.
  validateSearch: (search: Record<string, unknown>) => ({
    page: Math.max(1, Number(search.page) || 1),
  }),

  loaderDeps: ({ search }) => ({ page: search.page }),

  loader: ({ deps }) => listAuditLogsFn({ data: { page: deps.page } }),

  component: () => <Outlet />,
});
