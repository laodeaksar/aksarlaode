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

  loader: () => listAuditLogsFn({ data: { page: 1 } }),

  component: () => <Outlet />,
});
