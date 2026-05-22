// Rule: import siblings by direct path (not "@/lib") to avoid circular deps.

import { useEffect } from "react";

import { useLocation } from "@tanstack/react-router";

const STORAGE_KEY = "admin:recent-pages";
const MAX_RECENT = 5;

export type RecentPage = {
  to: string;
  label: string;
};

// Only static routes are tracked. Dynamic segments (/products/123) are
// excluded intentionally — their label is not available without loaderData.
const TRACKED_ROUTES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/products": "Products",
  "/products/new": "New Product",
  "/orders": "Orders",
  "/customers": "Customers",
  "/audit-logs": "Audit Logs",
  "/queue": "Email Queue",
  "/users": "Users",
  "/settings": "Settings",
};

export function getRecentPages(): RecentPage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as RecentPage[]) : [];
  } catch {
    return [];
  }
}

function setRecentPages(pages: RecentPage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
  } catch {
    // localStorage may be unavailable (e.g. SSR, private-browsing restrictions)
  }
}

export function recordRecentPage(pathname: string): void {
  const label = TRACKED_ROUTES[pathname];
  if (!label) return;
  const page: RecentPage = { to: pathname, label };
  const updated = [page, ...getRecentPages().filter((p) => p.to !== pathname)];
  setRecentPages(updated.slice(0, MAX_RECENT));
}

// Call this hook once at layout level to passively track every page visit.
export function useTrackRecentPage(): void {
  const location = useLocation();
  useEffect(() => {
    recordRecentPage(location.pathname);
  }, [location.pathname]);
}
