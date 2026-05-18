// ── src/components/index.ts — barrel export ───────────────────────────────
//
// Importa componenti interni sempre da qui:
//   import { Sidebar, Topbar, ErrorBoundary } from "@/components"
//
// Regola: i file DENTRO src/components/* che importano da fratelli
// usano il percorso diretto (e.g. "@/lib/rbac") per evitare circular deps.
// Questo barrel è solo per i CONSUMER esterni (route, __root.tsx, ecc).

export { ErrorBoundary } from "./error-boundary"
export { NotFound } from "./not-found"
export { DataTable } from "./data-table/data-table"
export { ProductForm } from "./forms/product-form"
export { Sidebar } from "./layout/sidebar"
export { Topbar } from "./layout/topbar"
