import { Outlet } from "@tanstack/react-router"
import { getDashboardStatsFn } from "@/server/dashboard"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/dashboard")({
  loader: () => getDashboardStatsFn({}),
  component: () => <Outlet />,
})
