import { createFileRoute } from "@tanstack/react-router"
import { lazy }            from "react"
import { listProductsFn }  from "@/server/products"

// ── Route — GET /products/ ─────────────────────────────────────────────────
// loader: runs on the SERVER during SSR (via TanStack Start server function).
// The result is serialized and streamed to the client for hydration.
// On client-side navigation, TanStack Start calls the server fn via HTTP.
//
// ProductsPage consumes the loader data via Route.useLoaderData() AND
// useQuery() for subsequent re-fetches / optimistic updates.

export const Route = createFileRoute("/products/")({
  // Server-side loader: fetch initial product list using Effect + ApiClientService
  loader: () =>
    listProductsFn({
      data: { page: 1, limit: 20 },
    }),

  // FIX ADM-06: Code-split — heavy DataTable is only loaded on navigation
  component: lazy(() => import("./products-page")),
})
