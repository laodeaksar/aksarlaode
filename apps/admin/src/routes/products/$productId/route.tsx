import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getProductFn } from "@/server/products";
import { can } from "@/lib";

export const Route = createFileRoute("/products/$productId")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session) throw redirect({ to: "/login" });
    if (!can(session.role, "products:read"))
      throw redirect({ to: "/forbidden" });
  },

  loader: ({ params, context }) => {
    const { queryClient } = context;
    return queryClient.ensureQueryData({
      queryKey: ["product", params.productId],
      queryFn: () => getProductFn({ data: { id: params.productId } }),
      staleTime: 5 * 60 * 1_000,
    });
  },

  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} — Admin`
          : "Detail Produk — Admin",
      },
    ],
  }),

  component: () => <Outlet />,
});
