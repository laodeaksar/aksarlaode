import { createFileRoute, redirect } from "@tanstack/react-router";

import { EditProduct } from "@/components/products/edit-product";
import { getProductFn } from "@/server/products";
import { can } from "@/lib";

export const Route = createFileRoute("/products/$productId")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session || !can(session.role, "products:write")) {
      throw redirect({ to: "/products" });
    }
  },

  // ensureQueryData populates React Query cache directly.
  // defaultPreload:'intent' calls this loader on hover → cache is warm by the
  // time the user clicks, so the component renders from cache with no loading
  // state.  On repeated visits within staleTime (60 s) no network request is
  // made at all.
  loader: ({ params, context }) => {
    const { queryClient } = context;
    return queryClient.ensureQueryData({
      queryKey: ["product", params.productId],
      queryFn: () => getProductFn({ data: { id: params.productId } }),
    });
  },

  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Edit: ${loaderData.name} — Admin`
          : "Edit Product — Admin",
      },
    ],
  }),

  component: function EditProductPage() {
    const { productId } = Route.useParams();
    return <EditProduct productId={productId} />;
  },
});
