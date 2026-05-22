// Single source of truth for sidebar navigation items.
//
// Every item declares the permission it requires; items the current
// user cannot access are filtered out before they reach the sidebar,
// so the user never sees a link that would redirect them to /forbidden.
//
// Rule: import siblings by direct path (not "@/lib") to avoid circular deps.

import {
  ClipboardListIcon,
  LayoutDashboardIcon,
  MailIcon,
  PackageIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  UsersIcon,
} from "lucide-react";
import { useMatch } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { can } from "@/lib/rbac";
import type { Permission } from "@/lib/rbac";
import { useSession } from "@/lib/session-context";
import { useNewOrdersCount } from "@/lib/use-new-orders";

export type NavItem = {
  title: string;
  url: string;
  icon: ReactNode;
  hasFilter?: boolean;
  badge?: number;
};

type NavItemDef = NavItem & { permission: Permission };

export function useNavItems(): NavItem[] {
  const { session } = useSession();
  const role = session?.role ?? "CUSTOMER";

  const pendingOrdersCount = useNewOrdersCount();

  // All useMatch calls are unconditional to satisfy React hooks rules.
  // They use `select` so the component only re-renders when the derived
  // boolean flips — not on every search-param keystroke.
  const hasProductsFilter =
    useMatch({
      from: "/products",
      shouldThrow: false,
      select: (m) => !!m?.search.search,
    }) ?? false;

  const hasOrdersFilter =
    useMatch({
      from: "/orders",
      shouldThrow: false,
      select: (m) => !!m?.search.status,
    }) ?? false;

  const hasCustomersFilter =
    useMatch({
      from: "/customers",
      shouldThrow: false,
      select: (m) => !!m?.search.search,
    }) ?? false;

  const hasAuditLogsFilter =
    useMatch({
      from: "/audit-logs",
      shouldThrow: false,
      select: (m) =>
        !!(
          m?.search.startDate ||
          m?.search.endDate ||
          m?.search.action ||
          m?.search.actorRole
        ),
    }) ?? false;

  const hasQueueFilter =
    useMatch({
      from: "/queue",
      shouldThrow: false,
      select: (m) => !!m?.search.jobType,
    }) ?? false;

  const allItems: NavItemDef[] = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
      permission: "dashboard:read",
    },
    {
      title: "Products",
      url: "/products",
      icon: <PackageIcon />,
      hasFilter: hasProductsFilter,
      permission: "products:read",
    },
    {
      title: "Orders",
      url: "/orders",
      icon: <ShoppingCartIcon />,
      hasFilter: hasOrdersFilter,
      badge: pendingOrdersCount,
      permission: "orders:read",
    },
    {
      title: "Customers",
      url: "/customers",
      icon: <UsersIcon />,
      hasFilter: hasCustomersFilter,
      permission: "customers:read",
    },
    {
      title: "Audit Logs",
      url: "/audit-logs",
      icon: <ClipboardListIcon />,
      hasFilter: hasAuditLogsFilter,
      permission: "audit:read",
    },
    {
      title: "Email Queue",
      url: "/queue",
      icon: <MailIcon />,
      hasFilter: hasQueueFilter,
      permission: "queue:read",
    },
    {
      title: "Users",
      url: "/users",
      icon: <ShieldCheckIcon />,
      permission: "users:manage",
    },
    {
      title: "Settings",
      url: "/settings",
      icon: <SettingsIcon />,
      permission: "settings:write",
    },
  ];

  return allItems
    .filter(({ permission }) => can(role, permission))
    .map(({ permission: _omit, ...item }) => item);
}
