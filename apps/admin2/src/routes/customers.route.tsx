import { Outlet } from "@tanstack/react-router"
import { createFileRoute } from "@tanstack/react-router"

import { listCustomersFn } from "@/server/customers"

export const Route = createFileRoute("/customers")({
  loader: () => listCustomersFn({ data: { page: 1 } }),
  component: () => <Outlet />,
})
