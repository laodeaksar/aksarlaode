// ── src/components/index.ts — root barrel ─────────────────────────────────
//
// Import internal components from here:
//   import { ErrorBoundary, DataTable, ProductForm } from "@/components"
//
// Or from a subfolder barrel for scoped imports:
//   import { AddProductDrawer } from "@/components/products"
//   import { CustomerDetail } from "@/components/customers"
//
// Layout components (AppSidebar, SiteHeader) are imported directly from
// their sub-paths in __root.tsx to avoid barrel circular deps.
//
// Rule: files INSIDE src/components/* that import siblings
// use the direct path (e.g. "@/components/forms/product-form") to avoid
// circular deps. This barrel is only for EXTERNAL consumers.

export * from "./shared";
export * from "./data-table";
export * from "./forms";
export * from "./products";
export * from "./customers";
export * from "./orders";
export * from "./audit-logs";
export * from "./login";
export * from "./dashboard";
