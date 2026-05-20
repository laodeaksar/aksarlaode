import { lazy } from "react";

import { createFileRoute } from "@tanstack/react-router";

const ProductsPage = lazy(() => import("./-page"));

export const Route = createFileRoute("/products/")({
  component: ProductsPage,
});
