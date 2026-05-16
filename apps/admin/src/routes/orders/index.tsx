import { createFileRoute } from "@tanstack/react-router"
import { lazy }            from "react"

// FIX ADM-06: Route-based code splitting — OrdersPage (DataTable, badge
// mapping, @tanstack/react-table) loaded in its own chunk on first navigation.
const OrdersPage = lazy(() => import("./orders-page"))

export const Route = createFileRoute("/orders/")({
  component: OrdersPage,
})
