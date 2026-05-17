import { Outlet } from "@tanstack/react-router"
import { listProductsFn } from "@/server/products"
import { createFileRoute, redirect } from "@tanstack/react-router"

import type { Session } from "@/lib/auth"
import { can } from "@/lib/rbac"

export const Route = createFileRoute("/products")({
  beforeLoad: ({ context }) => {
    const { session } = context as { session?: Session }
    if (!session || !can(session.role, "products:read")) {
      throw redirect({ to: "/dashboard" as any })
    }
  },

  loader: () =>
    listProductsFn({
      data: { page: 1, limit: 20 },
    }),

  component: () => <Outlet />,
})
