import { useCallback } from "react";

import { useNavigate } from "@tanstack/react-router";

/**
 * Centralises the three navigation patterns shared by every list page:
 *
 *  1. `setFilter(key, value)` — update a single filter and reset to page 1.
 *  2. `clearFilters(...keys)` — set multiple filter keys to undefined and
 *     reset to page 1 in a single navigation.
 *  3. `goToPage(n)` — paginate; omits `page` from the URL when n === 1.
 *
 * All three ensure `page` is absent from the URL when it would be 1 so URLs
 * stay minimal and meaningful.
 *
 * `to` is passed explicitly on every navigate call so the hook works
 * correctly even when called from a child route (e.g. /products/new
 * redirecting back to the /products list after a save).
 *
 * The `search` updater is cast to `any` at the call site to avoid TypeScript
 * recomputing a large route-union type on every invocation — runtime
 * validation is guaranteed by each route's `validateSearch: zodValidator(…)`.
 */
export function useFilteredNavigation(to: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigate = useNavigate() as any;

  const setFilter = useCallback(
    (key: string, value: string) => {
      navigate({
        to,
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          [key]: value || undefined,
          page: undefined,
        }),
      });
    },
    [navigate, to]
  );

  const clearFilters = useCallback(
    (...keys: string[]) => {
      navigate({
        to,
        search: (prev: Record<string, unknown>) => {
          const next: Record<string, unknown> = { ...prev, page: undefined };
          for (const key of keys) next[key] = undefined;
          return next;
        },
      });
    },
    [navigate, to]
  );

  const goToPage = useCallback(
    (newPage: number) => {
      navigate({
        to,
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          page: newPage > 1 ? newPage : undefined,
        }),
      });
    },
    [navigate, to]
  );

  return { setFilter, clearFilters, goToPage };
}
