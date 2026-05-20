import { createFileRoute } from "@tanstack/react-router";

import { ProductDetail } from "@/components/products";

export const Route = createFileRoute("/products/$productId/")({
  component: function ProductDetailPage() {
    const { productId } = Route.useParams();
    return <ProductDetail productId={productId} />;
  },
});
