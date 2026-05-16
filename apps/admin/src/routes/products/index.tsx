import { createFileRoute } from "@tanstack/react-router"
import { lazy }            from "react"

// FIX ADM-06: Route-based code splitting — the heavy ProductsPage component
// (DataTable, AlertDialog, @tanstack/react-table) is extracted to a separate
// chunk and only loaded when the user navigates to /products/.
// The Suspense fallback is provided by the global boundary in __root.tsx.
const ProductsPage = lazy(() => import("./products-page"))

export const Route = createFileRoute("/products/")({
  component: ProductsPage,
})
