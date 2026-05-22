import { useEffect, useState } from "react";

import { useNavigate } from "@tanstack/react-router";
import {
  ClipboardListIcon,
  ClockIcon,
  LayoutDashboardIcon,
  PackageIcon,
  PlusIcon,
  ShoppingCartIcon,
  UsersIcon,
} from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@repo/ui/components/command";

import { can, getRecentPages, useSession } from "@/lib";
import type { RecentPage } from "@/lib";

type NavEntry = {
  label: string;
  to: string;
  icon: React.ReactNode;
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { session } = useSession();
  const role = session?.role ?? "CUSTOMER";

  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);

  // Refresh recent pages from localStorage each time the palette opens.
  useEffect(() => {
    if (open) setRecentPages(getRecentPages());
  }, [open]);

  // ⌘K / Ctrl+K — toggle palette from anywhere in the app.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onOpenChange]);

  function go(to: string) {
    onOpenChange(false);
    navigate({ to });
  }

  const navItems: NavEntry[] = [
    {
      label: "Dashboard",
      to: "/dashboard",
      icon: <LayoutDashboardIcon />,
    },
    can(role, "products:read") && {
      label: "Products",
      to: "/products",
      icon: <PackageIcon />,
    },
    can(role, "products:write") && {
      label: "New Product",
      to: "/products/new",
      icon: <PlusIcon />,
    },
    can(role, "orders:read") && {
      label: "Orders",
      to: "/orders",
      icon: <ShoppingCartIcon />,
    },
    can(role, "customers:read") && {
      label: "Customers",
      to: "/customers",
      icon: <UsersIcon />,
    },
    can(role, "audit:read") && {
      label: "Audit Logs",
      to: "/audit-logs",
      icon: <ClipboardListIcon />,
    },
  ].filter((item): item is NavEntry => Boolean(item));

  // Only show recent pages the current role can still access.
  const allowedPaths = new Set(navItems.map((i) => i.to));
  const visibleRecent = recentPages.filter((p) => allowedPaths.has(p.to));

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Navigation"
      description="Jump to any page in the admin panel"
    >
      <Command>
        <CommandInput placeholder="Jump to..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {visibleRecent.length > 0 && (
            <>
              <CommandGroup heading="Recent">
                {visibleRecent.map((page) => {
                  const match = navItems.find((i) => i.to === page.to);
                  return (
                    <CommandItem
                      key={`recent-${page.to}`}
                      value={`recent ${page.label}`}
                      onSelect={() => go(page.to)}
                    >
                      {match?.icon ?? <ClockIcon />}
                      {page.label}
                      <CommandShortcut>↵</CommandShortcut>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Navigation">
            {navItems.map((item) => (
              <CommandItem
                key={item.to}
                value={item.label}
                onSelect={() => go(item.to)}
              >
                {item.icon}
                {item.label}
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
