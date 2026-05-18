import { Outlet } from "@tanstack/react-router"
import { listCustomersFn } from "@/server/customers"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/customers")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: Math.max(1, Number(search.page) || 1),
    search: typeof search.search === "string" ? search.search : "",
  }),

  loaderDeps: ({ search }) => ({
    page: search.page,
    search: search.search,
  }),

  loader: ({ deps }) =>
    listCustomersFn({
      data: {
        page: deps.page,
        ...(deps.search ? { search: deps.search } : {}),
      },
    }),

  component: () => <Outlet />,
})
