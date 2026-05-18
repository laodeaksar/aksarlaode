import { Outlet } from "@tanstack/react-router"
import { listAuditLogsFn } from "@/server/audit-logs"
import { createFileRoute, redirect } from "@tanstack/react-router"

import type { Session } from "@/lib/auth"
import { can } from "@/lib/rbac"

export const Route = createFileRoute("/audit-logs")({
  beforeLoad: ({ context }) => {
    const { session } = context as { session?: Session }
    if (!session || !can(session.role, "audit:read")) {
      throw redirect({ to: "/dashboard" })
    }
  },

  loader: () => listAuditLogsFn({ data: { page: 1 } }),

  component: () => <Outlet />,
})
