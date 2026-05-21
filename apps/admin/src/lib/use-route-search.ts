/**
 * Subscribe to a single selected value from a route's validated search params.
 *
 * TanStack Router's `Route.useSearch({ select })` already does referential
 * equality checking on the SELECT OUTPUT — so if the selector returns a
 * primitive (string, number, boolean, undefined), the component only
 * re-renders when THAT value changes, not when any other search param changes.
 *
 * This helper is a thin wrapper that makes the pattern explicit and consistent
 * across the codebase.
 *
 * ─── Usage ──────────────────────────────────────────────────────────────────
 *
 *   // ✅ Component re-renders only when `page` changes
 *   const page = useRouteSearch(Route, (s) => s.page);
 *
 *   // ✅ Multiple independent subscriptions — each re-renders independently
 *   const startDate = useRouteSearch(Route, (s) => s.startDate);
 *   const endDate   = useRouteSearch(Route, (s) => s.endDate);
 *
 * ─── Rules ──────────────────────────────────────────────────────────────────
 *
 *   1. Return a PRIMITIVE from the selector (string | number | boolean |
 *      undefined). Returning a new object each time defeats equality checks.
 *
 *   2. Keep derivations OUTSIDE the selector:
 *        const rawPage  = useRouteSearch(Route, (s) => s.page);
 *        const page     = rawPage ?? 1;        // ← derive here, not inside
 *
 *   3. If you need the FULL search object (e.g. to spread it), use
 *      `Route.useSearch()` directly — no selector needed.
 *
 *   4. Selectors are compared by reference; inline arrow functions are fine
 *      because TanStack Router compares the RETURNED VALUE, not the function.
 *
 * ─── When NOT to use ────────────────────────────────────────────────────────
 *
 *   - When the component already re-renders for other reasons (loader data,
 *     context, parent props) — the selective subscription brings no extra gain.
 *   - When you need multiple fields that always change together — just use
 *     `Route.useSearch()` and destructure.
 */
export function useRouteSearch<TSearch, TSelected>(
  route: { useSearch(opts: { select: (s: TSearch) => TSelected }): TSelected },
  selector: (search: TSearch) => TSelected
): TSelected {
  return route.useSearch({ select: selector });
}
