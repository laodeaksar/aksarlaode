import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { listProductsFn } from "@/server/products";
import { can } from "@/lib";

export const Route = createFileRoute("/products")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session || !can(session.role, "products:read")) {
      throw redirect({ to: "/dashboard" });
    }
  },

  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search.page) > 1 ? Math.floor(Number(search.page)) : undefined,
    search:
      typeof search.search === "string" && search.search
        ? search.search
        : undefined,
  }),

  loaderDeps: ({ search }) => ({
    page: search.page,
    search: search.search,
  }),

  loader: ({ deps, context }) => {
    const { queryClient } = context;
    return queryClient.ensureQueryData({
      queryKey: ["products", { page: deps.page ?? 1, search: deps.search }],
      queryFn: () =>
        listProductsFn({
          data: {
            page: deps.page ?? 1,
            limit: 20,
            ...(deps.search ? { search: deps.search } : {}),
          },
        }),
    });
  },

  head: () => ({
    meta: [{ title: "Products — Admin" }],
  }),

  component: () => <Outlet />,
});
