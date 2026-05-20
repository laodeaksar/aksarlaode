import { useEffect } from "react";

import { useNavigate } from "@tanstack/react-router";
import {
  ClipboardListIcon,
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
} from "@repo/ui/components/command";

import { can, useSession } from "@/lib";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { session } = useSession();
  const role = session?.role ?? "CUSTOMER";

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

  const navItems = [
    {
      label: "Dashboard",
      to: "/dashboard",
      icon: <LayoutDashboardIcon />,
      show: true,
    },
    {
      label: "Products",
      to: "/products",
      icon: <PackageIcon />,
      show: can(role, "products:read"),
    },
    {
      label: "New Product",
      to: "/products/new",
      icon: <PlusIcon />,
      show: can(role, "products:write"),
    },
    {
      label: "Orders",
      to: "/orders",
      icon: <ShoppingCartIcon />,
      show: can(role, "orders:read"),
    },
    {
      label: "Customers",
      to: "/customers",
      icon: <UsersIcon />,
      show: can(role, "customers:read"),
    },
    {
      label: "Audit Logs",
      to: "/audit-logs",
      icon: <ClipboardListIcon />,
      show: can(role, "audit:read"),
    },
  ].filter((item) => item.show);

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
          <CommandGroup heading="Navigation">
            {navItems.map((item) => (
              <CommandItem key={item.to} onSelect={() => go(item.to)}>
                {item.icon}
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
