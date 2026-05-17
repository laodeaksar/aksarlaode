import { Outlet } from "@tanstack/react-router"
import { listOrdersFn } from "@/server/orders"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/orders")({
  loader: () => listOrdersFn({ data: { page: 1 } }),
  component: () => <Outlet />,
})
