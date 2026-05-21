import { createFileRoute, redirect } from "@tanstack/react-router";

import { EditProduct } from "@/components/products";
import { can } from "@/lib";

export const Route = createFileRoute("/products/$productId/edit")({
  beforeLoad: ({ context, params }) => {
    const { session } = context;
    if (!session || !can(session.role, "products:write")) {
      throw redirect({ to: "/products/$productId", params });
    }
  },

  head: () => ({
    meta: [{ title: "Edit Produk — Admin" }],
  }),

  component: function EditProductPage() {
    const { productId } = Route.useParams();
    return <EditProduct productId={productId} />;
  },
});
