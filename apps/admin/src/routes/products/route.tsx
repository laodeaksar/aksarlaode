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
    page: Math.max(1, Number(search.page) || 1),
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
      queryKey: ["products", { page: deps.page, search: deps.search }],
      queryFn: () =>
        listProductsFn({
          data: {
            page: deps.page,
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
