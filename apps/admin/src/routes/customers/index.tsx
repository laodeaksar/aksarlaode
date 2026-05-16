import { createFileRoute } from "@tanstack/react-router"
import { lazy }            from "react"

// FIX ADM-06: Route-based code splitting — CustomersPage loaded in its own
// chunk; DataTable + react-table dependency deferred until first navigation.
const CustomersPage = lazy(() => import("./customers-page"))

export const Route = createFileRoute("/customers/")({
  component: CustomersPage,
})
