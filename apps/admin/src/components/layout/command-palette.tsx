import { useEffect, useState } from "react";

import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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

import { can, formatIDR, getRecentPages, queryKeys, useSession } from "@/lib";
import type { RecentPage } from "@/lib";
import { listProductsFn } from "@/server/products";

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

  // The raw text the user has typed — updated on every keystroke.
  const [searchTerm, setSearchTerm] = useState("");

  // Debounced term used for the API call.
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Refresh recent pages from localStorage each time the palette opens.
  useEffect(() => {
    if (open) setRecentPages(getRecentPages());
  }, [open]);

  // Clear search text when palette closes so next open starts fresh.
  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setDebouncedSearch("");
    }
  }, [open]);

  // Debounce the API call by 300 ms; skip if fewer than 2 chars.
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setDebouncedSearch("");
      return;
    }
    const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

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

  const canSearchProducts = can(role, "products:read");

  // Live product search — fires once debouncedSearch reaches 2+ chars.
  const { data: productData, isFetching: productsFetching } = useQuery({
    queryKey: queryKeys.products.search(debouncedSearch),
    queryFn: () =>
      listProductsFn({
        data: { search: debouncedSearch, page: 1, limit: 5 },
      }),
    enabled: canSearchProducts && debouncedSearch.length >= 2,
    staleTime: 30_000,
    // Keep showing previous results while new ones load.
    placeholderData: (prev) => prev,
  });
  const products = productData?.items ?? [];

  function go(to: string) {
    onOpenChange(false);
    navigate({ to });
  }

  const navItems = (
    [
      { label: "Dashboard", to: "/dashboard", icon: <LayoutDashboardIcon /> },
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
    ] as (NavEntry | false)[]
  ).filter((item): item is NavEntry => Boolean(item));

  // Disable cmdk's built-in filter so we control all filtering ourselves.
  // This lets server-fetched product results bypass client-side re-filtering.
  const q = searchTerm.toLowerCase();
  const filteredNavItems = q
    ? navItems.filter((i) => i.label.toLowerCase().includes(q))
    : navItems;

  // Only show recent pages the current role can still access.
  const allowedPaths = new Set(navItems.map((i) => i.to));
  const visibleRecent = recentPages
    .filter((p) => allowedPaths.has(p.to))
    .filter((p) => (q ? p.label.toLowerCase().includes(q) : true));

  // Show the Products group when: user has permission + debounced term active.
  const showProducts = canSearchProducts && debouncedSearch.length >= 2;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Navigation"
      description="Jump to any page or search products"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Jump to page or search products…"
          value={searchTerm}
          onValueChange={setSearchTerm}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* Recent pages — hidden when search term filters everything out */}
          {visibleRecent.length > 0 && (
            <>
              <CommandGroup heading="Recent">
                {visibleRecent.map((page) => {
                  const match = navItems.find((i) => i.to === page.to);
                  return (
                    <CommandItem
                      key={`recent-${page.to}`}
                      value={`recent-${page.to}`}
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

          {/* Live product search results */}
          {showProducts && (
            <>
              <CommandGroup
                heading={
                  productsFetching ? "Products — searching…" : "Products"
                }
              >
                {products.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={`product-${product.id}`}
                    onSelect={() => go(`/products/${product.id}`)}
                  >
                    <PackageIcon />
                    <span className="flex-1 truncate">{product.name}</span>
                    <CommandShortcut>
                      {formatIDR(product.price)}
                    </CommandShortcut>
                  </CommandItem>
                ))}
                {!productsFetching && products.length === 0 && (
                  <CommandItem disabled value="no-products">
                    <span className="text-muted-foreground text-sm">
                      No products match &ldquo;{debouncedSearch}&rdquo;
                    </span>
                  </CommandItem>
                )}
              </CommandGroup>
              {filteredNavItems.length > 0 && <CommandSeparator />}
            </>
          )}

          {/* Navigation — always present, filtered by typed text */}
          {filteredNavItems.length > 0 && (
            <CommandGroup heading="Navigation">
              {filteredNavItems.map((item) => (
                <CommandItem
                  key={item.to}
                  value={item.to}
                  onSelect={() => go(item.to)}
                >
                  {item.icon}
                  {item.label}
                  <CommandShortcut>↵</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
