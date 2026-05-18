import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { listProductsFn } from "@/server/products";
import { can, type Session } from "@/lib";

export const Route = createFileRoute("/products")({
  beforeLoad: ({ context }) => {
    const { session } = context as { session?: Session };
    if (!session || !can(session.role, "products:read")) {
      throw redirect({ to: "/dashboard" });
    }
  },

  validateSearch: (search: Record<string, unknown>) => ({
    page: Math.max(1, Number(search.page) || 1),
    search: typeof search.search === "string" ? search.search : "",
  }),

  loaderDeps: ({ search }) => ({
    page: search.page,
    search: search.search,
  }),

  loader: ({ deps }) =>
    listProductsFn({
      data: {
        page: deps.page,
        limit: 20,
        ...(deps.search ? { search: deps.search } : {}),
      },
    }),

  component: () => <Outlet />,
});
