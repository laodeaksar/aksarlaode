// ── src/components/index.ts — barrel export ───────────────────────────────
//
// Importa componenti interni sempre da qui:
//   import { ErrorBoundary, DataTable, ProductForm } from "@/components"
//
// Layout components (AppSidebar, SiteHeader) are imported directly from
// their sub-paths in __root.tsx to avoid barrel circular deps.
//
// Regola: i file DENTRO src/components/* che importano da fratelli
// usano il percorso diretto (e.g. "@/lib/rbac") per evitare circular deps.
// Questo barrel è solo per i CONSUMER esterni (route, __root.tsx, ecc).

export { ErrorBoundary } from "./error-boundary";
export { NotFound } from "./not-found";
export { DataTable } from "./data-table/data-table";
export { ProductForm } from "./forms/product-form";
