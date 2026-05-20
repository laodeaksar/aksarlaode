import { createFileRoute, redirect } from "@tanstack/react-router";

import { NewProduct } from "@/components/products/new-product";
import { can } from "@/lib";

export const Route = createFileRoute("/products/new")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session || !can(session.role, "products:write")) {
      throw redirect({ to: "/products" });
    }
  },

  head: () => ({
    meta: [{ title: "New Product — Admin" }],
  }),

  component: NewProduct,
});
