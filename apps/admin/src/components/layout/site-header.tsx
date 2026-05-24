import * as React from "react";

import { Link, useMatches } from "@tanstack/react-router";

import { SearchIcon } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/breadcrumb";
import { Kbd, KbdGroup } from "@repo/ui/components/kbd";
import { Separator } from "@repo/ui/components/separator";
import { SidebarTrigger } from "@repo/ui/components/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

type BreadcrumbSegment = {
  label: string;
  href: string;
};

type RouteMatch = ReturnType<typeof useMatches>[number];

function matchToSegment(match: RouteMatch): BreadcrumbSegment | null {
  const id = match.id;

  // Skip root shell and all index routes (trailing slash or root "/")
  if (id === "__root__" || id === "/" || id.endsWith("/")) return null;

  const params = match.params as Record<string, string>;
  const ld = match.loaderData as Record<string, unknown> | undefined;

  switch (id) {
    case "/dashboard":
      return { label: "Dashboard", href: "/dashboard" };

    case "/products":
      return { label: "Products", href: "/products" };

    case "/products/new":
      return { label: "New Product", href: "/products/new" };

    case "/products/$productId": {
      const name = typeof ld?.name === "string" ? ld.name : null;
      return {
        label: name ?? "Product",
        href: `/products/${params.productId}`,
      };
    }

    case "/products/$productId/edit":
      return {
        label: "Edit",
        href: `/products/${params.productId}/edit`,
      };

    case "/orders":
      return { label: "Orders", href: "/orders" };

    case "/orders/$orderId": {
      const orderId =
        typeof ld?.orderId === "string"
          ? ld.orderId
          : (params.orderId ?? "").slice(0, 8).toUpperCase();
      return {
        label: `Order #${orderId}`,
        href: `/orders/${params.orderId}`,
      };
    }

    case "/customers":
      return { label: "Customers", href: "/customers" };

    case "/customers/$userId": {
      const name = typeof ld?.name === "string" ? ld.name : null;
      return {
        label: name ?? "Customer Detail",
        href: `/customers/${params.userId}`,
      };
    }

    case "/audit-logs":
      return { label: "Audit Logs", href: "/audit-logs" };

    default:
      return null;
  }
}

type SiteHeaderProps = {
  onOpenCommand?: () => void;
};

export function SiteHeader({ onOpenCommand }: SiteHeaderProps) {
  const matches = useMatches();

  const segments = matches
    .map(matchToSegment)
    .filter((s): s is BreadcrumbSegment => s !== null);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        {segments.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList>
              {segments.map((segment, index) => {
                const isLast = index === segments.length - 1;
                return (
                  <React.Fragment key={segment.href}>
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          render={<Link to={segment.href} preload={false} />}
                        >
                          {segment.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}

        {onOpenCommand && (
          <Tooltip>
            <TooltipTrigger
              className="text-muted-foreground ml-auto flex h-8 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-2 text-sm font-normal shadow-xs hover:bg-accent hover:text-accent-foreground sm:px-3"
              onClick={onOpenCommand}
              aria-label="Open command palette"
            >
              <SearchIcon className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">Jump to…</span>
              <KbdGroup className="ml-0.5 hidden sm:inline-flex">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Command palette
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </header>
  );
}
