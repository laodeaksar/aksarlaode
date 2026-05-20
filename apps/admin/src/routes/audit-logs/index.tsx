import { lazy } from "react";

import { createFileRoute } from "@tanstack/react-router";

const AuditLogsPage = lazy(() => import("./-page"));

export const Route = createFileRoute("/audit-logs/")({
  component: AuditLogsPage,
});
