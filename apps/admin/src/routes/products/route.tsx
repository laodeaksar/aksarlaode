import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";

import { listProductsFn } from "@/server/products";
import { productsSearchSchema } from "@/lib/search-schemas";
import { can } from "@/lib";

export const Route = createFileRoute("/products")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session) throw redirect({ to: "/login" });
    if (!can(session.role, "products:read")) throw redirect({ to: "/forbidden" });
  },

  validateSearch: zodValidator(productsSearchSchema),

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
