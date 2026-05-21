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

import { can, useSession } from "@/lib";

import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { NavUser } from "./nav-user";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { session } = useSession();
  const role = session?.role ?? "CUSTOMER";

  const productsMatch = useMatch({ from: "/products", shouldThrow: false });
  const ordersMatch = useMatch({ from: "/orders", shouldThrow: false });
  const customersMatch = useMatch({ from: "/customers", shouldThrow: false });
  const auditLogsMatch = useMatch({ from: "/audit-logs", shouldThrow: false });

  const navMain = [
    { title: "Dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> },
    ...(can(role, "products:read")
      ? [
          {
            title: "Products",
            url: "/products",
            icon: <PackageIcon />,
            hasFilter: !!productsMatch?.search.search,
          },
        ]
      : []),
    ...(can(role, "orders:read")
      ? [
          {
            title: "Orders",
            url: "/orders",
            icon: <ShoppingCartIcon />,
            hasFilter: !!ordersMatch?.search.status,
          },
        ]
      : []),
    ...(can(role, "customers:read")
      ? [
          {
            title: "Customers",
            url: "/customers",
            icon: <UsersIcon />,
            hasFilter: !!customersMatch?.search.search,
          },
        ]
      : []),
    ...(can(role, "audit:read")
      ? [
          {
            title: "Audit Logs",
            url: "/audit-logs",
            icon: <ClipboardListIcon />,
            hasFilter: !!(
              auditLogsMatch?.search.startDate ||
              auditLogsMatch?.search.endDate ||
              auditLogsMatch?.search.action ||
              auditLogsMatch?.search.actorRole
            ),
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
