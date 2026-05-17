import { lazy } from "react"
import { listOrdersFn } from "@/server/orders"
import { createFileRoute } from "@tanstack/react-router"

// FIX ADM-06: Route-based code splitting — OrdersPage (DataTable, badge
// mapping, @tanstack/react-table) loaded in its own chunk on first navigation.
const OrdersPage = lazy(() => import("./orders-page"))

export const Route = createFileRoute("/orders/")({
  // SSR loader: first page of orders fetched server-side.
  // OrdersPage seeds useQuery initialData from this result so the table
  // renders immediately with no client-side loading spinner on first visit.
  loader: () => listOrdersFn({ data: { page: 1 } }),

  component: OrdersPage,
}
