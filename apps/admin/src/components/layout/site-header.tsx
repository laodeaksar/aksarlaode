import { useRouterState } from "@tanstack/react-router";

import { Separator } from "@repo/ui/components/separator";
import { SidebarTrigger } from "@repo/ui/components/sidebar";

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/products/new": "New Product",
  "/products": "Products",
  "/orders": "Orders",
  "/customers": "Customers",
  "/audit-logs": "Audit Logs",
};

function getPageTitle(pathname: string): string {
  const match = Object.entries(ROUTE_TITLES)
    .filter(([route]) => pathname.startsWith(route))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return match?.[1] ?? "Admin";
}

export function SiteHeader() {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="text-base font-medium">{getPageTitle(pathname)}</h1>
      </div>
    </header>
  );
}
