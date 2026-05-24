import { lazy } from "react";

import { createFileRoute } from "@tanstack/react-router";

const QueuePage = lazy(() => import("./-page"));

export const Route = createFileRoute("/queue/")({
  component: QueuePage,
});
