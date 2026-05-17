import { lazy } from "react"
import { listProductsFn } from "@/server/products"
import { createFileRoute, redirect } from "@tanstack/react-router"

import type { Session } from "@/lib/auth"
import { can } from "@/lib/rbac"

// ── Route — GET /products/ ─────────────────────────────────────────────────
// loader: runs on the SERVER during SSR (via TanStack Start server function).
// The result is serialized and streamed to the client for hydration.
// On client-side navigation, TanStack Start calls the server fn via HTTP.
//
// ProductsPage consumes the loader data via Route.useLoaderData() AND
// useQuery() for subsequent re-fetches / optimistic updates.

export const Route = createFileRoute("/products/")({
  // Route-level RBAC: FINANCE role does not have products:read.
  // Redirect to dashboard rather than showing an empty/broken page.
  beforeLoad: ({ context }) => {
    const { session } = context as { session?: Session }
    if (!session || !can(session.role, "products:read")) {
      throw redirect({ to: "/dashboard" as any })
    }
  },

  // Server-side loader: fetch initial product list using Effect + ApiClientService
  loader: () =>
    listProductsFn({
      data: { page: 1, limit: 20 },
    }),

  // FIX ADM-06: Code-split — heavy DataTable is only loaded on navigation
  component: lazy(() => import("./products-page")),
})
