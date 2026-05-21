import { useQuery } from "@tanstack/react-query";
import { useMatch } from "@tanstack/react-router";

import { getPendingOrdersCountFn } from "@/server/notifications";

const POLL_INTERVAL = 30_000;

/**
 * Polls the server every 30 s for the PENDING_PAYMENT order count.
 * Returns 0 while the admin is already on the Orders page (they can
 * already see the list) or if the backend is unreachable.
 */
export function useNewOrdersCount(): number {
  const onOrdersPage = useMatch({ from: "/orders", shouldThrow: false });

  const { data = 0 } = useQuery({
    queryKey: ["notifications", "pending-orders"],
    queryFn: () => getPendingOrdersCountFn(),
    refetchInterval: POLL_INTERVAL,
    staleTime: POLL_INTERVAL,
    retry: false,
    throwOnError: false,
  });

  return onOrdersPage ? 0 : data;
}
