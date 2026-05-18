import { lazy } from "react";

import { createFileRoute } from "@tanstack/react-router";

const AuditLogsPage = lazy(() => import("./audit-logs-page"));

export const Route = createFileRoute("/audit-logs/")({
  component: AuditLogsPage,
});
