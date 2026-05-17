import { Outlet } from "@tanstack/react-router"
import { listOrdersFn } from "@/server/orders"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/orders")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: Math.max(1, Number(search.page) || 1),
    status: typeof search.status === "string" ? search.status : "",
  }),

  loaderDeps: ({ search }) => ({
    page: search.page,
    status: search.status,
  }),

  loader: ({ deps }) =>
    listOrdersFn({
      data: { page: deps.page, ...(deps.status ? { status: deps.status } : {}) },
    }),

  component: () => <Outlet />,
})
