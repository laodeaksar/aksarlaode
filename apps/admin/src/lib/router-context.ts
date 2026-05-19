import type { QueryClient } from "@tanstack/react-query";

import type { Session } from "./auth";

export interface RouterContext {
  queryClient: QueryClient;
  session?: Session;
}
