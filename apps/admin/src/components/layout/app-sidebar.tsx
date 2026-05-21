import * as React from "react";

import { Link, useMatch } from "@tanstack/react-router";

import {
  ClipboardListIcon,
  CommandIcon,
  LayoutDashboardIcon,
  PackageIcon,
  Settings2Icon,
  ShoppingCartIcon,
  UsersIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/sidebar";

import { can, useNewOrdersCount, useSession } from "@/lib";

import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { NavUser } from "./nav-user";

// ── Narrowed match selectors ────────────────────────────────────────────────
// Each useMatch call uses `select` so the component only re-renders when the
// derived boolean flips — not on every search-param keystroke.

function useHasProductsFilter() {
  return useMatch({
    from: "/products",
    shouldThrow: false,
    select: (m) => !!m?.search.search,
  });
}

function useHasOrdersFilter() {
  return useMatch({
    from: "/orders",
    shouldThrow: false,
    select: (m) => !!m?.search.status,
  });
}

function useHasCustomersFilter() {
  return useMatch({
    from: "/customers",
    shouldThrow: false,
    select: (m) => !!m?.search.search,
  });
}

function useHasAuditLogsFilter() {
  return useMatch({
    from: "/audit-logs",
    shouldThrow: false,
    select: (m) =>
      !!(
        m?.search.startDate ||
        m?.search.endDate ||
        m?.search.action ||
        m?.search.actorRole
      ),
  });
}

// ── Component ───────────────────────────────────────────────────────────────

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { session } = useSession();
  const role = session?.role ?? "CUSTOMER";

  const hasProductsFilter = useHasProductsFilter();
  const hasOrdersFilter = useHasOrdersFilter();
  const hasCustomersFilter = useHasCustomersFilter();
  const hasAuditLogsFilter = useHasAuditLogsFilter();

  const pendingOrdersCount = useNewOrdersCount();

  const navMain = [
    { title: "Dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> },
    ...(can(role, "products:read")
      ? [
          {
            title: "Products",
            url: "/products",
            icon: <PackageIcon />,
            hasFilter: hasProductsFilter,
          },
        ]
      : []),
    ...(can(role, "orders:read")
      ? [
          {
            title: "Orders",
            url: "/orders",
            icon: <ShoppingCartIcon />,
            hasFilter: hasOrdersFilter,
            badge: pendingOrdersCount,
          },
        ]
      : []),
    ...(can(role, "customers:read")
      ? [
          {
            title: "Customers",
            url: "/customers",
            icon: <UsersIcon />,
            hasFilter: hasCustomersFilter,
          },
        ]
      : []),
    ...(can(role, "audit:read")
      ? [
          {
            title: "Audit Logs",
            url: "/audit-logs",
            icon: <ClipboardListIcon />,
            hasFilter: hasAuditLogsFilter,
          },
        ]
      : []),
  ];

  const navSecondary = [
    { title: "Settings", url: "#", icon: <Settings2Icon /> },
  ];

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link to="/dashboard" />}
            >
              <CommandIcon />
              <span className="text-base font-semibold">Admin Panel</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
