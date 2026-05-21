import * as React from "react";

import { useRouterState } from "@tanstack/react-router";

import type { LucideIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/sidebar";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    hasFilter?: boolean;
    badge?: number;
  }[];
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive =
              pathname === item.url || pathname.startsWith(item.url + "/");

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isActive}
                  render={<a href={item.url} />}
                >
                  <span className="relative flex shrink-0 items-center">
                    {item.icon}
                    {item.hasFilter && !item.badge && (
                      <span
                        className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-orange-400"
                        aria-label="Active filter"
                      />
                    )}
                  </span>
                  <span className="flex-1">{item.title}</span>
                  {!!item.badge && (
                    <span
                      className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold tabular-nums text-white"
                      aria-label={`${item.badge} pesanan baru`}
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
