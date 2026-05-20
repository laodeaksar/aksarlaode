// ── src/components/index.ts — barrel export ───────────────────────────────
//
// Import internal components from here:
//   import { ErrorBoundary, DataTable, ProductForm } from "@/components"
//
// Layout components (AppSidebar, SiteHeader) are imported directly from
// their sub-paths in __root.tsx to avoid barrel circular deps.
//
// Rule: files INSIDE src/components/* that import siblings
// use the direct path (e.g. "@/lib/rbac") to avoid circular deps.
// This barrel is only for EXTERNAL consumers (routes, __root.tsx, etc).

// ── Shared ─────────────────────────────────────────────────────────────────
export { ErrorBoundary } from "./shared/error-boundary";
export { NotFound } from "./shared/not-found";
export { DefaultCatchBoundary } from "./shared/default-catch-boundary";

// ── Data Table ─────────────────────────────────────────────────────────────
export { DataTable } from "./data-table/data-table";

// ── Forms ──────────────────────────────────────────────────────────────────
export { ProductForm } from "./forms/product-form";

// ── Products ───────────────────────────────────────────────────────────────
export { AddProductDrawer } from "./products/add-product-drawer";
export { DeleteProductButton } from "./products/delete-product-button";
export { getProductColumns } from "./products/product-columns";

// ── Customers ──────────────────────────────────────────────────────────────
export { customerColumns } from "./customers/customer-columns";
export { CustomerDetail } from "./customers/customer-detail";

// ── Orders ─────────────────────────────────────────────────────────────────
export { orderColumns, ORDER_STATUSES, STATUS_VARIANTS } from "./orders/order-columns";
export { OrderDetail } from "./orders/order-detail";

// ── Audit Logs ─────────────────────────────────────────────────────────────
export { auditLogColumns, AUDIT_ACTIONS, ACTOR_ROLES } from "./audit-logs/audit-log-columns";

// ── Login ──────────────────────────────────────────────────────────────────
export { LoginPageSkeleton } from "./login/login-skeleton";

// ── Dashboard ──────────────────────────────────────────────────────────────
export { StatCard } from "./dashboard/stat-card";
export { RecentOrdersTable } from "./dashboard/recent-orders-table";
export { TopProductsList } from "./dashboard/top-products-list";
export { DashboardSkeleton } from "./dashboard/dashboard-skeleton";
